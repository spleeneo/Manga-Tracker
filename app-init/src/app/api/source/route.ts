import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { mangaId, sourceName, sourceUrl } = body;

        if (!mangaId || !sourceName || !sourceUrl) {
            return NextResponse.json(
                { error: "Missing required fields: mangaId, sourceName, sourceUrl" },
                { status: 400 }
            );
        }

        // Verify manga exists
        const manga = await prisma.manga.findUnique({
            where: { id: mangaId },
        });

        if (!manga) {
            return NextResponse.json(
                { error: "Manga not found" },
                { status: 404 }
            );
        }

        // Check for duplicate source (same manga, same name)
        const existingSource = await prisma.source.findUnique({
            where: {
                mangaId_sourceName: {
                    mangaId,
                    sourceName,
                },
            },
        });

        if (existingSource) {
            return NextResponse.json(
                { error: "Source with this name already exists for this manga" },
                { status: 409 }
            );
        }

        const source = await prisma.source.create({
            data: {
                mangaId,
                sourceName,
                sourceUrl,
            },
        });

        return NextResponse.json(source, { status: 201 });
    } catch (error) {
        console.error("Error creating source:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
