import type { PCChunk } from "prismarine-chunk";
import type { Tile } from "@/app/types";
import Vec3 from "vec3";
import type { Buffer } from "node:buffer";

interface AnvilInstance {
  save: (x: number, z: number, chunk: PCChunk) => Promise<void>;
  getAllRegions: () => Array<{
    getName: () => string;
    getBuffer: () => Buffer;
  }>;
}

interface BlockData {
  id: number;
}

export interface WorldGenerationOptions {
  Chunk: typeof PCChunk;
  Anvil: new () => AnvilInstance;
  mcData: {
    blocksByName: Record<string, BlockData>;
  };
  blocksToPlace: Array<Array<Tile | undefined>>;
}

/**
 * Generates a superflat Minecraft world with custom blocks
 */
export async function generateWorld(
  options: WorldGenerationOptions,
): Promise<void> {
  const { Chunk, Anvil, mcData, blocksToPlace } = options;

  const BEDROCK = mcData.blocksByName["bedrock"]?.id;
  const DIRT = mcData.blocksByName["dirt"]?.id;
  const GRASS_BLOCK_DEFAULT_STATE = 9;
  const PLAINS_BIOME = 39;

  if (!BEDROCK || !DIRT) {
    throw new Error("Required blocks (bedrock, dirt) not found in mcData");
  }

  const anvil = new Anvil();
  const chunk = new Chunk(null);

  async function createSuperflatChunk(x: number, z: number): Promise<void> {
    for (let bx = 0; bx < 16; bx++) {
      for (let bz = 0; bz < 16; bz++) {
        chunk.setBiome(
          Vec3(bx + x * 16, 3 - 64, bz + z * 16),
          PLAINS_BIOME,
        );

        chunk.setBlockType(Vec3(bx, 0 - 64, bz), BEDROCK);
        chunk.setBlockType(Vec3(bx, 1 - 64, bz), DIRT);
        chunk.setBlockType(Vec3(bx, 2 - 64, bz), DIRT);

        const blockToPlace = blocksToPlace[16 * x + bx]?.[16 * z + bz];
        const blockToPlaceVec3 = Vec3(bx, 3 - 64, bz);

        if (blockToPlace) {
          chunk.setBlockType(blockToPlaceVec3, blockToPlace.id);
        } else {
          chunk.setBlockStateId(blockToPlaceVec3, GRASS_BLOCK_DEFAULT_STATE);
        }
      }
    }

    await anvil.save(x, z, chunk);
  }

  const chunkPromises: Array<Promise<void>> = [];
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 8; z++) {
      chunkPromises.push(createSuperflatChunk(x, z));
    }
  }

  await Promise.all(chunkPromises);
}

