import { NextResponse } from "next/server";

import sharp from "sharp";

// Luminance Calculation (Weighted Average of RGB):
function getLuminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

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

        // Create a buffer with raw pixel data (e.g., a red rectangle)
        const newRawBuffer = Buffer.alloc(width * height * channels);
        const quantizationBuffer = Buffer.alloc(width * height * channels);
        const factor = 1
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
        // for (let y = 0; y < height-1; y++) {
        //     for (let x = 1; x < width-1; x++) {
                const flippedY = height - y;
                const index = channels * (width * y + x);
                
                // rawNewBuffer[index    ] = 255;
                // rawNewBuffer[index + 1] = 255;
                // rawNewBuffer[index + 2] = 255;
                // rawNewBuffer[index + 3] = 255;

                newRawBuffer[index    ] = rawBuffer[index    ];
                newRawBuffer[index + 1] = rawBuffer[index + 1];
                newRawBuffer[index + 2] = rawBuffer[index + 2];
                newRawBuffer[index + 3] = rawBuffer[index + 3];


                const fract = (x: number) => x - Math.trunc(x)
                const dot = (vec1: { x: number, y: number }, vec2: { x: number, y: number }) => vec1.x*vec2.x+vec1.y*vec2.y;
                // ign
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


                // Floyd–Steinberg dithering
                // quantization 
                quantizationBuffer[index    ] = Math.round(factor * rawBuffer[index    ]  / 255) * Math.floor(255 / factor);
                quantizationBuffer[index + 1] = Math.round(factor * rawBuffer[index + 1]  / 255) * Math.floor(255 / factor);
                quantizationBuffer[index + 2] = Math.round(factor * rawBuffer[index + 2]  / 255) * Math.floor(255 / factor);
                quantizationBuffer[index + 3] = rawBuffer[index + 3];
                
                const quantErrorR = newRawBuffer[index    ] - quantizationBuffer[index    ]
                const quantErrorG = newRawBuffer[index + 1] - quantizationBuffer[index + 1]
                const quantErrorB = newRawBuffer[index + 2] - quantizationBuffer[index + 2]

                newRawBuffer[index    ] = quantizationBuffer[index    ]
                newRawBuffer[index + 1] = quantizationBuffer[index + 1]
                newRawBuffer[index + 2] = quantizationBuffer[index + 2]

                const getIndex = (x: number, y: number) => channels * (width * y + x)

                newRawBuffer[getIndex(x + 1, y    )    ] += (quantErrorR * 7 / 16)
                newRawBuffer[getIndex(x + 1, y    ) + 1] += (quantErrorG * 7 / 16)
                newRawBuffer[getIndex(x + 1, y    ) + 2] += (quantErrorB * 7 / 16)
                
                newRawBuffer[getIndex(x - 1, y + 1)    ] += (quantErrorR * 3 / 16)
                newRawBuffer[getIndex(x - 1, y + 1) + 1] += (quantErrorG * 3 / 16)
                newRawBuffer[getIndex(x - 1, y + 1) + 2] += (quantErrorB * 3 / 16)

                newRawBuffer[getIndex(x    , y + 1)    ] += (quantErrorR * 5 / 16)
                newRawBuffer[getIndex(x    , y + 1) + 1] += (quantErrorG * 5 / 16)
                newRawBuffer[getIndex(x    , y + 1) + 2] += (quantErrorB * 5 / 16)

                newRawBuffer[getIndex(x + 1, y + 1)    ] += (quantErrorR * 1 / 16)
                newRawBuffer[getIndex(x + 1, y + 1) + 1] += (quantErrorG * 1 / 16)
                newRawBuffer[getIndex(x + 1, y + 1) + 2] += (quantErrorB * 1 / 16)
            }
        }
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

