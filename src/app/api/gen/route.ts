import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

import prismarineChunk, { type PCChunk } from "prismarine-chunk";
import prismarineProvider from "../../../libs/provider";
// @ts-expect-error - minecraft-assets doesn't have type definitions
import McAssets from "minecraft-assets";
import McData from "minecraft-data";

import sharp from "sharp";
import { initializeTileColors } from "@/lib/tile-initialization";
import { convertImageToBlocks } from "@/lib/image-to-blocks";
import { createPreviewImage } from "@/lib/image-processing";
import { generateWorld } from "@/lib/world-generation";
import { createWorldZip } from "@/lib/zip-creation";
import { getCachedPreviewImage } from "@/app/cache";

const CHUNK_SIZE = 10;
const DEFAULT_MC_VERSION = "1.21.1";
const WORLD_SIZE_CHUNKS = 8;

export async function POST(req: Request) {
  try {
    console.time("whole");

    // Parse form data
    console.time("parse-form");
    const formData = await req.formData();
    const img = formData.get("img") as File | null;
    const mcVersion =
      (formData.get("version") as string | null) || DEFAULT_MC_VERSION;

    if (!img) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 },
      );
    }

    const imgArrayBuffer = await img.arrayBuffer();
    console.timeEnd("parse-form");

    // Initialize Minecraft data
    console.time("init-mc-data");
    const mcAssets = McAssets(mcVersion);
    const mcData = McData(mcVersion);
    await initializeTileColors(mcAssets, mcData);
    console.timeEnd("init-mc-data");

    // Get image dimensions
    const targetImage = sharp(imgArrayBuffer);
    const metadata = await targetImage.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width === 0 || height === 0) {
      return NextResponse.json(
        { error: "Invalid image dimensions" },
        { status: 400 },
      );
    }

    // Convert image to blocks
    console.time("image-to-blocks");
    const { blocksToPlace, composites } = await convertImageToBlocks({
      imageBuffer: imgArrayBuffer,
      chunkSize: CHUNK_SIZE,
      width,
      height,
    });
    console.timeEnd("image-to-blocks");

    // Check if preview image is cached (from /api/preview-image)
    console.time("preview-image");
    let previewImageBuffer = getCachedPreviewImage(imgArrayBuffer, mcVersion);
    if (!previewImageBuffer) {
      // Not cached, generate it
      console.log("Preview not cached, generating...");
      previewImageBuffer = await createPreviewImage(
        width,
        height,
        composites,
      );
    } else {
      console.log("Using cached preview image");
    }
    console.timeEnd("preview-image");

    // Initialize world generation
    console.time("init-world-gen");
    const Chunk = prismarineChunk(mcVersion) as unknown as typeof PCChunk;
    const Anvil = prismarineProvider.Anvil(mcVersion);
    console.timeEnd("init-world-gen");

    // Generate world
    console.time("generate-world");
    const anvil = new Anvil();
    await generateWorld({
      Chunk,
      Anvil,
      mcData,
      blocksToPlace,
    });
    console.timeEnd("generate-world");

    // Read level.dat
    const levelDatPath = path.join(process.cwd(), "src/data/level.dat");
    const levelDatBuffer = await fs.readFile(levelDatPath);

    // Create ZIP file
    console.time("create-zip");
    const zipBuffer = await createWorldZip({
      originalImage: {
        name: img.name,
        buffer: imgArrayBuffer,
      },
      previewImage: previewImageBuffer,
      levelDat: levelDatBuffer,
      regions: anvil.getAllRegions(),
    });
    console.timeEnd("create-zip");

    console.timeEnd("whole");

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="map.zip"',
      },
    });
  } catch (error) {
    console.error("Error generating map:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate map",
      },
      { status: 500 },
    );
  }
}
