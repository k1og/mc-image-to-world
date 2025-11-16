import { tileColorsCache } from "../../cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {

  return new NextResponse(tileColorsCache.size.toString(), {
    headers: {
      // "Content-Type": "application/zip",
      // "Content-Disposition": 'attachment; filename="map.jpg"',
    },
  });
}