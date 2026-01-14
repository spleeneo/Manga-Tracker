import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const manga = await prisma.manga.findUnique({
            where: { slug },
            include: {
                sources: true,
                chapters: {
                    orderBy: { chapterNumber: 'desc' },
                }
            }
        });

        if (!manga) {
            return NextResponse.json({ error: "Manga not found" }, { status: 404 });
        }

        return NextResponse.json(manga);
    } catch (error) {
        console.error("Error fetching manga:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
