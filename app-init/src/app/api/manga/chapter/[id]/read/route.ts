import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { isRead } = await request.json();

        const chapter = await prisma.chapter.update({
            where: { id },
            data: { isRead: !!isRead }
        });

        return NextResponse.json(chapter);
    } catch (error) {
        console.error("Failed to update chapter status:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
