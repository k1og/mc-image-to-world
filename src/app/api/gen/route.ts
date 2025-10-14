import JSZip from "jszip";
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

import prismarineChunk, { type PCChunk } from "prismarine-chunk";
import prismarineProvider from "../../../libs/provider";
import Vec3 from "vec3";

export async function POST(req: Request) {
  const formaData = await req.formData();
  const img = formaData.get("img") as File | null;
  const mcVersion = (formaData.get("version") as string | null) || "1.29.1";

  if (!img) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const imgArrayBuffer = await img.arrayBuffer();

  const Chunk = prismarineChunk(mcVersion) as unknown as typeof PCChunk;
  const Anvil = prismarineProvider.Anvil(mcVersion);

  // Create Anvil provider (handles region files)
  const anvil = new Anvil();
  const chunk = new Chunk(null);

  // Generate small flat world
  async function generateWorld() {
    // Block IDs for superflat
    const BEDROCK = 7;
    const DIRT = 3;
    const GRASS = 2;

    // Generate one chunk
    async function createSuperflatChunk(x: number, z: number) {
      for (let bx = 0; bx < 16; bx++) {
        for (let bz = 0; bz < 16; bz++) {
          chunk.setBlockType(Vec3(bx, 0 - 64, bz), BEDROCK);
          chunk.setBlockType(Vec3(bx, 1 - 64, bz), DIRT);
          chunk.setBlockType(Vec3(bx, 2 - 64, bz), DIRT);
          chunk.setBlockType(Vec3(bx, 3 - 64, bz), GRASS);
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
