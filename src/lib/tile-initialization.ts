import type { Tile } from "@/app/types";
import { tileColorsCache } from "@/app/cache";
import { getAverageColor } from "./image-processing";

/**
 * Initializes the tile colors cache from Minecraft assets
 */
interface TextureContent {
  name: string;
  texture: string | null;
}

interface BlockData {
  id: number;
  defaultState: number;
  boundingBox: string;
}

export async function initializeTileColors(
  mcAssets: {
    textureContent: Record<string, TextureContent>;
  },
  mcData: {
    blocksByName: Record<string, BlockData>;
  },
): Promise<void> {
  if (tileColorsCache.size > 0) {
    return; // Already initialized
  }

  const initializationPromises = Object.values(mcAssets.textureContent).map(
    async ({ texture, name }) => {
      if (!texture) {
        return;
      }

      const blockData = mcData.blocksByName[name];
      if (!blockData || blockData.boundingBox === "empty") {
        return;
      }

      const textureBuffer = Buffer.from(
        texture.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const averageColor = await getAverageColor(textureBuffer);

      tileColorsCache.set(blockData.id, {
        averageColor,
        name,
        texture,
        textureBuffer,
        id: blockData.id,
        defaultState: blockData.defaultState,
      });
    },
  );

  await Promise.all(initializationPromises);
}

