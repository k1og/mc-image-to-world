import { NextResponse } from "next/server";

import sharp from "sharp";
import vec3 from 'vec3'

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const img = formData.get("img") as File | null;
        if (!img) {
            return NextResponse.json(
                { error: "No image provided" },
                { status: 400 },
            );
        }

        const imgArrayBuffer = await img.arrayBuffer();

        const targetImage = sharp(imgArrayBuffer)
        const { width, height, channels } = await targetImage.metadata();

        const rawBuffer = await targetImage.raw().toBuffer();

        // ign dithering
        const newRawBuffer = Buffer.alloc(width * height * channels);        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const flippedY = height - y;
                const index = channels * (width * y + x);

                newRawBuffer[index    ] = rawBuffer[index    ];
                newRawBuffer[index + 1] = rawBuffer[index + 1];
                newRawBuffer[index + 2] = rawBuffer[index + 2];
                newRawBuffer[index + 3] = rawBuffer[index + 3];


                const fract = (x: number) => x - Math.trunc(x)
                const dot = (vec1: { x: number, y: number }, vec2: { x: number, y: number }) => vec1.x*vec2.x+vec1.y*vec2.y;
                const noise = fract(52.9829189 * fract(dot({x,y: flippedY}, {x: 0.06711056, y:  0.00583715})))
                if (noise * 255 > newRawBuffer[index]) {
                    newRawBuffer[index    ] = 0;
                    newRawBuffer[index + 1] = 0;
                    newRawBuffer[index + 2] = 0;
                } else {
                    newRawBuffer[index    ] = 255;
                    newRawBuffer[index + 1] = 255;
                    newRawBuffer[index + 2] = 255;
                }
            }
        }

        // floyd steinberg dithering
        // const newRawBuffer = Buffer.from(rawBuffer)
        // const getIndex = (x: number, y: number) => channels * (width * y + x);
        
        // const factor = 1;
        // for (let y = 0; y < height - 1; y++) {
        //     for (let x = 0; x < width - 1; x++) {
        //         const oldPixel = vec3(
        //             newRawBuffer[getIndex(x, y)    ], 
        //             newRawBuffer[getIndex(x, y) + 1], 
        //             newRawBuffer[getIndex(x, y) + 2],
        //         );

        //         // Calculate the new color
        //         const newPixel = vec3(
        //             Math.round(factor * oldPixel.x  / 255) * Math.floor(255 / factor),
        //             Math.round(factor * oldPixel.y  / 255) * Math.floor(255 / factor),
        //             Math.round(factor * oldPixel.z  / 255) * Math.floor(255 / factor)
        //         );

        //         newRawBuffer[getIndex(x, y)    ] = newPixel.x;
        //         newRawBuffer[getIndex(x, y) + 1] = newPixel.y;
        //         newRawBuffer[getIndex(x, y) + 2] = newPixel.z;

        //         const quantError = oldPixel.minus(newPixel);

        //         // Right
        //         newRawBuffer[getIndex(x + 1, y    )    ] += quantError.x * 7 / 16;
        //         newRawBuffer[getIndex(x + 1, y    ) + 1] += quantError.y * 7 / 16;
        //         newRawBuffer[getIndex(x + 1, y    ) + 2] += quantError.z * 7 / 16;
    
        //         // Below left
        //         newRawBuffer[getIndex(x - 1, y + 1)    ] += quantError.x * 3 / 16;
        //         newRawBuffer[getIndex(x - 1, y + 1) + 1] += quantError.y * 3 / 16;
        //         newRawBuffer[getIndex(x - 1, y + 1) + 2] += quantError.z * 3 / 16;

        //         // Below
        //         newRawBuffer[getIndex(x    , y + 1)    ] += quantError.x * 5 / 16;
        //         newRawBuffer[getIndex(x    , y + 1) + 1] += quantError.y * 5 / 16;
        //         newRawBuffer[getIndex(x    , y + 1) + 2] += quantError.z * 5 / 16;

        //         // Below right
        //         newRawBuffer[getIndex(x + 1, y + 1)    ] += quantError.x * 1 / 16;
        //         newRawBuffer[getIndex(x + 1, y + 1) + 1] += quantError.y * 1 / 16;
        //         newRawBuffer[getIndex(x + 1, y + 1) + 2] += quantError.z * 1 / 16;
        //     }
        // }
        const image = await sharp(newRawBuffer, {
            raw: {
                width: width,
                height: height,
                channels: channels,
            },
        })
        .png()
        .toBuffer()

        return new NextResponse(Buffer.from(image), {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": 'inline; filename="preview.png"',
            },
        });
    } catch (error) {
        console.error("Error generating preview:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to generate preview",
            },
            { status: 500 },
        );
    }
}

