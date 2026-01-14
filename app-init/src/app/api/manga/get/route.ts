import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug");

    if (!slug) {
        return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    try {
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
