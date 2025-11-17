import type { Buffer } from "node:buffer";

export type RGB = { r: number; g: number; b: number };

export type Tile = {
  averageColor: RGB;
  name: string;
  texture: string;
  textureBuffer: Buffer;
  id: number;
  defaultState: number;
};
