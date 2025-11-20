import sharp, { type OverlayOptions } from "sharp";
import type { ImageComposite, RGB, Tile } from "@/app/types";
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
    .flatten({background: { r: 255, g: 255, b: 255}})
    .resize(1, 1, { fit: "cover" })
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
      .resize(width, height)
      .flatten({background: { r: 255, g: 255, b: 255}})
      .raw()
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
  composites: Array<Array<ImageComposite>>,
): Promise<Buffer> {
  const imgBuffer = Buffer.alloc(width * height * 3);        
  const getIndex = (x: number, y: number, width: number) => 3 * (width * y + x);

  const compositeWidth = composites[0][0].width
  const compositeHeight = composites[0][0].height

  for (let x = 0; x < composites.length; x++) {
    for (let y = 0; y < composites[0].length; y++) {
      for (let innerX = 0; innerX < compositeWidth; innerX++) {
        for (let innerY = 0; innerY < compositeHeight; innerY++) {
          const imageIndex = getIndex(compositeWidth * x + innerX, compositeWidth * y + innerY, width)
          const compositeIndex = getIndex(innerX, innerY, compositeWidth)
          
          imgBuffer[imageIndex     ] = composites[x][y].data[compositeIndex      ]
          imgBuffer[imageIndex  + 1] = composites[x][y].data[compositeIndex  +  1]
          imgBuffer[imageIndex  + 2] = composites[x][y].data[compositeIndex  +  2]
        }
      }
    }
  }
    const image = await sharp(imgBuffer, {
        raw: {
            width: width,
            height: height,
            channels: 3,
        },
    })
    .jpeg()
    .toBuffer()
  return image
}
