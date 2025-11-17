import JSZip from "jszip";
import type { Buffer } from "node:buffer";

interface ZipCreationOptions {
  originalImage: {
    name: string;
    buffer: ArrayBuffer;
  };
  previewImage: Buffer;
  levelDat: Buffer;
  regions: Array<{
    getName: () => string;
    getBuffer: () => Buffer;
  }>;
}

/**
 * Creates a ZIP file containing the original image, preview, and Minecraft world
 */
export async function createWorldZip(
  options: ZipCreationOptions,
): Promise<Buffer> {
  const { originalImage, previewImage, levelDat, regions } = options;

  const zip = new JSZip();
  zip.file(originalImage.name, originalImage.buffer);
  zip.file("preview.jpg", previewImage);

  const zipWorldFolder = zip.folder("image_world");
  if (!zipWorldFolder) {
    throw new Error("Failed to create world folder in ZIP");
  }

  zipWorldFolder.file("level.dat", levelDat);
  const zipRegionWorldFolder = zipWorldFolder.folder("region");
  if (!zipRegionWorldFolder) {
    throw new Error("Failed to create region folder in ZIP");
  }

  regions.forEach((region) => {
    zipRegionWorldFolder.file(region.getName(), region.getBuffer());
  });

  return await zip.generateAsync({ type: "nodebuffer" });
}

