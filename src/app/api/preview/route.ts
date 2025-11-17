import { tileColorsCache } from "../../cache";
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    cacheSize: tileColorsCache.size,
    initialized: tileColorsCache.size > 0,
  });
}