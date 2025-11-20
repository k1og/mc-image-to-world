import sharp, { type OverlayOptions, type Sharp } from "sharp";
import type { ImageComposite, RGB, Tile } from "@/app/types";
import { findClosestTile } from "./color-matching";
import { getPixelColor, getResizedTileBuffer } from "./image-processing";

interface ImageToBlocksOptions {
  image: Sharp;
  chunkSize: number;
  width: number;
  height: number;
}

interface ImageToBlocksResult {
  blocksToPlace: Array<Array<Tile | undefined>>;
  composites: Array<Array<ImageComposite>>;
}

/**
 * Converts an image to Minecraft blocks by matching colors
 */
export async function convertImageToBlocks(
  options: ImageToBlocksOptions,
): Promise<ImageToBlocksResult> {
  const { image, chunkSize, width, height } = options;

  const downsampleWidth = Math.ceil(width / chunkSize);
  const downsampleHeight = Math.ceil(height / chunkSize);

  const { data, info } = await image
    .resize(downsampleWidth, downsampleHeight)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blocksToPlace: Array<Array<Tile | undefined>> = [[]];
  const composites: Array<Array<ImageComposite>> = [[]];
  for (let y = 0; y < downsampleHeight; y++) {
    for (let x = 0; x < downsampleWidth; x++) {
      const pixelColor = getPixelColor(
        x,
        y,
        downsampleWidth,
        data,
        info.channels,
      );
      const closestTile = findClosestTile(pixelColor);
      const tileBuffer = await getResizedTileBuffer(
        closestTile,
        chunkSize,
        chunkSize,
      );

      if (!blocksToPlace[x]) {
        blocksToPlace[x] = [];
      }
      blocksToPlace[x][y] = closestTile;

      if (!composites[x]) {
        composites[x] = []
      }
      composites[x][y] = {
        data: tileBuffer,
        width: chunkSize,
        height: chunkSize,
      }
    }
  }
  return { blocksToPlace, composites };
}

