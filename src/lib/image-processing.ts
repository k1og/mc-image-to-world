import sharp, { type OverlayOptions } from "sharp";
import type { RGB, Tile } from "@/app/types";
import { tileTextureBufferCache } from "@/app/cache";

/**
 * Calculates the average RGB color of an image buffer
 */
export async function getAverageColor(
  imageBuffer: Buffer,
): Promise<RGB> {
  const {
    data: [r, g, b],
  } = await sharp(imageBuffer)
    .resize(1, 1, { fit: "fill", kernel: 'nearest' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { r, g, b };
}

/**
 * Gets or creates a resized tile buffer with caching
 */
export async function getResizedTileBuffer(
  tile: Tile,
  width: number,
  height: number,
): Promise<Buffer> {
  const key = `${tile.id}-${width}-${height}`;
  if (!tileTextureBufferCache.has(key)) {
    const buf = await sharp(tile.textureBuffer)
      .resize(width, height, { kernel: 'nearest' })
      .toBuffer();
    tileTextureBufferCache.set(key, buf);
  }

  return tileTextureBufferCache.get(key)!;
}

/**
 * Extracts pixel color from raw image data
 */
export function getPixelColor(
  x: number,
  y: number,
  width: number,
  data: Buffer,
  channels: number = 3,
): RGB {
  const offset = channels * (width * y + x);
  const r = data[offset] ?? 0;
  const g = data[offset + 1] ?? 0;
  const b = data[offset + 2] ?? 0;
  return { r, g, b };
}

/**
 * Creates a preview image by compositing tile textures
 */
export async function createPreviewImage(
  width: number,
  height: number,
  composites: Array<OverlayOptions>,
): Promise<Buffer> {
  return await sharp({
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
    .jpeg()
    .toBuffer();
}

