import sharp, { type OverlayOptions } from "sharp";
import type { RGB, Tile } from "@/app/types";
import { findClosestTile } from "./color-matching";
import { getPixelColor, getResizedTileBuffer } from "./image-processing";

interface ImageToBlocksOptions {
  imageBuffer: ArrayBuffer;
  chunkSize: number;
  width: number;
  height: number;
}

interface ImageToBlocksResult {
  blocksToPlace: Array<Array<Tile | undefined>>;
  composites: Array<OverlayOptions>;
}

/**
 * Converts an image to Minecraft blocks by matching colors
 */
export async function convertImageToBlocks(
  options: ImageToBlocksOptions,
): Promise<ImageToBlocksResult> {
  const { imageBuffer, chunkSize, width, height } = options;

  const downsampleWidth = Math.ceil(width / chunkSize);
  const downsampleHeight = Math.ceil(height / chunkSize);

  const targetImage = sharp(imageBuffer);
  const { data, info } = await targetImage
    .resize(downsampleWidth, downsampleHeight)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blocksToPlace: Array<Array<Tile | undefined>> = [[]];
  const composites: Array<OverlayOptions> = [];
  const processingTasks: Array<Promise<void>> = [];

  for (let y = 0; y < downsampleHeight; y++) {
    for (let x = 0; x < downsampleWidth; x++) {
      processingTasks.push(
        (async () => {
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

          composites.push({
            input: tileBuffer,
            left: x * chunkSize,
            top: y * chunkSize,
          });
        })(),
      );
    }
  }

  await Promise.all(processingTasks);

  return { blocksToPlace, composites };
}

