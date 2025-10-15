const tileColors = new Map<
  number,
  {
    averageColor: { r: number; g: number; b: number };
    name: string;
    texture: string;
    textureBuffer: Buffer<ArrayBuffer>;
    id: number;
  }
>();

const tileTextureBuffer = new Map<string, Buffer<ArrayBufferLike>>();

const globalForTileColorsCache = global as unknown as { tileColorsCache: typeof tileColors }

export const tileColorsCache = globalForTileColorsCache.tileColorsCache ?? tileColors
if (!globalForTileColorsCache.tileColorsCache) {
  globalForTileColorsCache.tileColorsCache = tileColors
}

const globalForTileTextureBufferCache = global as unknown as { tileTextureBufferCache: typeof tileTextureBuffer }
export const tileTextureBufferCache = globalForTileTextureBufferCache.tileTextureBufferCache ?? tileTextureBuffer
if (!globalForTileTextureBufferCache.tileTextureBufferCache) {
  globalForTileTextureBufferCache.tileTextureBufferCache = tileTextureBuffer
}