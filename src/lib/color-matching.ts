import type { RGB, Tile } from "@/app/types";
import { tileColorsCache } from "@/app/cache";

/**
 * Finds the closest matching tile based on color similarity
 * Uses Manhattan distance for color comparison
 */
export function findClosestTile(
  targetColor: RGB,
  tiles: Map<number, Tile> = tileColorsCache,
): Tile {
  let closestTile: Tile | null = null;
  let closestDistance = Infinity;

  for (const tile of tiles.values()) {
    const { averageColor } = tile;
    const distance =
      Math.abs(averageColor.r - targetColor.r) +
      Math.abs(averageColor.g - targetColor.g) +
      Math.abs(averageColor.b - targetColor.b);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTile = tile;
    }
  }

  if (!closestTile) {
    throw new Error("No tiles available for color matching");
  }

  return closestTile;
}

