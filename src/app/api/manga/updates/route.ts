import { getCurrentUserId } from "@/lib/session";
import { enqueueUserLibrarySyncJobs, processQueuedSyncJobs } from "@/lib/sync-jobs";
import { after } from "next/server";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const { queued } = await enqueueUserLibrarySyncJobs(userId);
        const processed = await processQueuedSyncJobs({ limit: Math.max(queued, 1), concurrency: 4 });

        after(async () => {
            try {
                await processQueuedSyncJobs({ limit: Math.max(queued, 1), concurrency: 4 });
            } catch (error) {
                console.error("Library update jobs failed:", error);
            }
        });

        return NextResponse.json({ success: true, queued, ...processed });
    } catch (error) {
        console.error("Library update failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
