import type { Tile } from "./types";
import type { Buffer } from "node:buffer";

const tileColors = new Map<number, Tile>();
const tileTextureBuffer = new Map<string, Buffer>();

interface GlobalCache {
  tileColorsCache: Map<number, Tile>;
  tileTextureBufferCache: Map<string, Buffer>;
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