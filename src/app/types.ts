export type RGB = { r: number; g: number; b: number };

export type Tile = {
  averageColor: RGB;
  name: string;
  texture: string;
  textureBuffer: Buffer<ArrayBuffer>;
  id: number;
  defaultState: number;
};
