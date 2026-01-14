import { checkForUpdates } from "@/lib/manga-updater";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Ensure this isn't cached

export async function GET() {
    try {
        const results = await checkForUpdates();
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("Cron update failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
