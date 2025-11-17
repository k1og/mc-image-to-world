import type { Tile } from "./types";
import type { Buffer } from "node:buffer";
import { Buffer as NodeBuffer } from "node:buffer";
import { createHash } from "node:crypto";

const tileColors = new Map<number, Tile>();
const tileTextureBuffer = new Map<string, Buffer>();
const previewImageCacheMap = new Map<string, Buffer>();

interface GlobalCache {
  tileColorsCache: Map<number, Tile>;
  tileTextureBufferCache: Map<string, Buffer>;
  previewImageCache: Map<string, Buffer>;
}

const globalForCache = global as unknown as GlobalCache;

export const tileColorsCache =
  globalForCache.tileColorsCache ?? tileColors;
if (!globalForCache.tileColorsCache) {
  globalForCache.tileColorsCache = tileColors;
}

export const tileTextureBufferCache =
  globalForCache.tileTextureBufferCache ?? tileTextureBuffer;
if (!globalForCache.tileTextureBufferCache) {
  globalForCache.tileTextureBufferCache = tileTextureBuffer;
}

export const previewImageCache =
  globalForCache.previewImageCache ?? previewImageCacheMap;
if (!globalForCache.previewImageCache) {
  globalForCache.previewImageCache = previewImageCacheMap;
}

/**
 * Generates a cache key from image buffer and Minecraft version
 */
export function getPreviewCacheKey(
  imageBuffer: ArrayBuffer,
  mcVersion: string,
): string {
  const hash = createHash("sha256");
  hash.update(NodeBuffer.from(imageBuffer));
  hash.update(mcVersion);
  return hash.digest("hex");
}

/**
 * Gets cached preview image if available
 */
export function getCachedPreviewImage(
  imageBuffer: ArrayBuffer,
  mcVersion: string,
): Buffer | null {
  const key = getPreviewCacheKey(imageBuffer, mcVersion);
  return previewImageCache.get(key) ?? null;
}

/**
 * Stores preview image in cache
 */
export function setCachedPreviewImage(
  imageBuffer: ArrayBuffer,
  mcVersion: string,
  previewBuffer: Buffer,
): void {
  const key = getPreviewCacheKey(imageBuffer, mcVersion);
  previewImageCache.set(key, previewBuffer);
  
  // Limit cache size to prevent memory issues (keep last 10 entries)
  if (previewImageCache.size > 10) {
    const firstKey = previewImageCache.keys().next().value;
    if (firstKey) {
      previewImageCache.delete(firstKey);
    }
  }
}