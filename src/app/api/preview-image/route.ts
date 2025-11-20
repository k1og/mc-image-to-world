import { NextResponse } from "next/server";

import sharp from "sharp";
// @ts-expect-error - minecraft-assets doesn't have type definitions
import McAssets from "minecraft-assets";
import McData from "minecraft-data";

import { initializeTileColors } from "@/lib/tile-initialization";
import { convertImageToBlocks } from "@/lib/image-to-blocks";
import { createPreviewImage } from "@/lib/image-processing";
import {
  getCachedPreviewImage,
  setCachedPreviewImage,
} from "@/app/cache";
import { DEFAULT_MC_VERSION, CHUNK_SIZE } from "@/app/constants";

export async function POST(req: Request) {
  try {
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

    // Check cache first
    // const cachedPreview = getCachedPreviewImage(imgArrayBuffer, mcVersion);
    // if (cachedPreview) {
    //   console.log("Using cached preview image");
    //   return new NextResponse(Buffer.from(cachedPreview), {
    //     headers: {
    //       "Content-Type": "image/jpeg",
    //       "Content-Disposition": 'inline; filename="preview.jpg"',
    //     },
    //   });
    // }

    // Initialize Minecraft data
    const mcAssets = McAssets(mcVersion);
    const mcData = McData(mcVersion);
    await initializeTileColors(mcAssets, mcData);

    const targetImage = sharp(imgArrayBuffer)
    const { width, height } = await sharp(imgArrayBuffer).metadata();

    // Convert image to blocks
    const { composites } = await convertImageToBlocks({
      image: targetImage,
      chunkSize: CHUNK_SIZE,
      width,
      height,
    });

    // Create preview image
    const previewImageBuffer = await createPreviewImage(
      width,
      height,
      composites,
    );

    // Cache the preview image for reuse in /api/gen
    setCachedPreviewImage(imgArrayBuffer, mcVersion, previewImageBuffer);

    return new NextResponse(Buffer.from(previewImageBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'inline; filename="preview.jpg"',
      },
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate preview",
      },
      { status: 500 },
    );
  }
}

