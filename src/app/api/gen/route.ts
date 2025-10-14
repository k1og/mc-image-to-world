import JSZip from "jszip";

import { NextResponse } from "next/server";

import path from "node:path";
import fs from "node:fs/promises";

import prismarineChunk, { type PCChunk } from "prismarine-chunk";
import prismarineProvider from "../../../libs/provider";
import Vec3 from "vec3";
// @ts-expect-error
import McAssets from "minecraft-assets";
import McData from "minecraft-data";

import sharp from "sharp";

const getAverageColor = async (imageBuffer: Buffer<ArrayBuffer>) => {
  const {
    data: [r, g, b],
  } = await sharp(imageBuffer)
    .resize(1, 1, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { r, g, b };
};
const tileColors: Array<{
  averageColor: { r: number; g: number; b: number };
  name: string;
  texture: string;
  textureBuffer: Buffer<ArrayBuffer>;
  id: number;
}> = [];

export async function POST(req: Request) {
  const formaData = await req.formData();
  const img = formaData.get("img") as File | null;
  const mcVersion = (formaData.get("version") as string | null) || "1.29.1";

  if (!img) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const imgArrayBuffer = await img.arrayBuffer();

  const mcAssets = McAssets(mcVersion);
  const mcData = McData(mcVersion);

  if (!tileColors.length) {
    (
      Object.values(mcAssets.textureContent) as Array<{
        name: string;
        texture: string | null;
      }>
    ).forEach(async ({ texture, name }) => {
      if (!texture) {
        return;
      }

      const blockData = mcData.blocksByName[name];
      if (!blockData || blockData.boundingBox === "empty") {
        return;
      }

      const textureBuffer = Buffer.from(
        texture.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      const { r, g, b } = await getAverageColor(textureBuffer);
      tileColors.push({
        averageColor: { r, g, b },
        name,
        texture,
        textureBuffer,
        id: blockData.id,
      });
    });
  }

  const targetImage = sharp(imgArrayBuffer);
  const { width, height } = await targetImage.metadata();

  const composites = [];

  const chunkSize = 25;
  const blocksToPlace: Array<
    Array<{
      averageColor: { r: number; g: number; b: number };
      name: string;
      texture: string;
      textureBuffer: Buffer<ArrayBuffer>;
      id: number;
    }>
  > = [];

  for (let chunkY = 0; chunkY < height; chunkY += chunkSize) {
    for (let chunkX = 0; chunkX < width; chunkX += chunkSize) {
      //   console.log(chunkX, chunkY, chunkX / chunkSize, chunkY / chunkSize);
      const {
        data: [r, g, b],
      } = await sharp(imgArrayBuffer)
        .extract({
          left: chunkX,
          top: chunkY,
          width: Math.min(chunkX + chunkSize, width) - chunkX,
          height: Math.min(chunkY + chunkSize, height) - chunkY,
        })
        .resize(1, 1)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const averageColor = { r, g, b };

      let closestColorTile = tileColors[0];
      let closestColorVal = Infinity;
      tileColors.forEach((color) => {
        const {
          averageColor: { r, g, b },
        } = color;
        const val =
          Math.abs(r - averageColor.r) +
          Math.abs(g - averageColor.g) +
          Math.abs(b - averageColor.b);
        if (val < closestColorVal) {
          closestColorVal = val;
          closestColorTile = color;
        }
      });

      if (!blocksToPlace[chunkX / chunkSize]) {
        blocksToPlace[chunkX / chunkSize] = [];
      }
      blocksToPlace[chunkX / chunkSize][chunkY / chunkSize] = closestColorTile;

      composites.push({
        input: await sharp(closestColorTile.textureBuffer)
          .resize(
            Math.min(chunkX + chunkSize, width) - chunkX,
            Math.min(chunkY + chunkSize, height) - chunkY
          )
          .toBuffer(),
        left: chunkX,
        top: chunkY,
      });
    }
  }

  const finalImageBuffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    },
  })
    .composite(composites)
    .toBuffer();

  const Chunk = prismarineChunk(mcVersion) as unknown as typeof PCChunk;
  const Anvil = prismarineProvider.Anvil(mcVersion);

  // Create Anvil provider (handles region files)
  const anvil = new Anvil();
  const chunk = new Chunk(null);

  // Generate small flat world
  async function generateWorld() {
    // Block IDs for superflat
    const BEDROCK = mcData.blocksByName["bedrock"].id;
    const DIRT = mcData.blocksByName["dirt"].id;
    const GRASS = mcData.blocksByName["grass_block"].id;

    // Generate one chunk
    async function createSuperflatChunk(x: number, z: number) {
      for (let bx = 0; bx < 16; bx++) {
        for (let bz = 0; bz < 16; bz++) {
          chunk.setBiome(Vec3(bx, 0 - 64, bz), 40);
          chunk.setBlockType(Vec3(bx, 0 - 64, bz), BEDROCK);
          chunk.setBlockType(Vec3(bx, 1 - 64, bz), DIRT);
          chunk.setBlockType(Vec3(bx, 2 - 64, bz), DIRT);
          chunk.setBlockType(
            Vec3(bx, 3 - 64, bz),
            blocksToPlace[16 * x + bx]?.[16 * z + bz]?.id || GRASS
          );
        }
      }

      await anvil.save(x, z, chunk);
    }

    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        await createSuperflatChunk(x, z);
      }
    }
  }

  const levelDatPath = path.join(process.cwd(), "src/data/level.dat");
  const levelDatBuffer = await fs.readFile(levelDatPath);

  await generateWorld();

  const zip = new JSZip();

  zip.file(img.name, imgArrayBuffer);
  zip.file("mosaic.jpg", finalImageBuffer);
  const zipWorldFolder = zip.folder("image_world");
  zipWorldFolder!.file("level.dat", levelDatBuffer);
  const zipRegionWorldFolder = zipWorldFolder!.folder("region");

  anvil.getAllRegions().forEach((region) => {
    zipRegionWorldFolder!.file(region.getName(), region.getBuffer());
  });

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="map.zip"',
    },
  });
}
