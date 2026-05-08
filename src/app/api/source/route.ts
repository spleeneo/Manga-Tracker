import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

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

        // Check for duplicate source (same manga, same URL)
        const existingSource = await prisma.source.findUnique({
            where: {
                mangaId_sourceUrl: {
                    mangaId,
                    sourceUrl,
                },
            },
        });

        if (existingSource) {
            return NextResponse.json(
                { error: "Source with this URL already exists for this manga" },
                { status: 409 }
            );
        }

        const tracked = await prisma.userManga.findUnique({
            where: {
                userId_mangaId: {
                    userId,
                    mangaId,
                },
            },
        });

        if (!tracked) {
            return NextResponse.json(
                { error: "Manga not tracked by this user" },
                { status: 403 }
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
