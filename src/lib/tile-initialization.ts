import { tileColorsCache } from "@/app/cache";
import { getAverageColor } from "./image-processing";
import McData from "minecraft-data";

/**
 * Initializes the tile colors cache from Minecraft assets
 */
interface TextureContent {
  name: string;
  texture: string | null;
}

export async function initializeTileColors(
  mcAssets: {
    textureContent: Record<string, TextureContent>;
  },
  mcData: McData.IndexedData
): Promise<void> {
  if (tileColorsCache.size > 0) {
    return; // Already initialized
  }

  const forbiddenBlocks: Record<string, boolean> = {
    // animated
    "sculk_catalyst": true,
    // different color
    "sculk_shrieker": true,
    "sculk_sensor": true,
    "calibrated_sculk_sensor": true,
    // darker in game
    "end_portal_frame": true,
    "grindstone": true,
    "anvil": true,
    // different image
    "bell": true,
    "cake": true,
    "smithing_table": true,
    // image like dirt (w/o grass)
    "grass_block": true,
    // image & same as slabs
    "comparator": true,
    "repeater": true,
    // different orientation
    "furnace": true,
    "blast_furnace": true,
    "observer": true,
    "piston": true,
  }

  const initializationPromises = Object.values(mcAssets.textureContent).map(
    async ({ texture, name }) => {
      if (!texture) {
        return;
      }
    
      const blockData = mcData.blocksByName[name];
      if (!blockData 
        || blockData.boundingBox === "empty" 
        || blockData.transparent 
        || forbiddenBlocks[blockData.name] 
        || blockData.name.endsWith('_slab')
        || blockData.name.endsWith('_stairs')
        // same as in forbiddenBlocks
        || blockData.name.endsWith('_cake')
        || blockData.name.endsWith('_anvil')
        || blockData.name.endsWith('_piston')
        // different image
        || blockData.name.includes('fence')
      ) {
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

