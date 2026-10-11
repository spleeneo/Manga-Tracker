import { enqueueTrackedMangaSyncJobs, processQueuedSyncJobs, getSyncQueueMetrics } from "@/lib/sync-jobs";
import { NextRequest, NextResponse } from "next/server";
import { drainSyncQueue } from "@/lib/sync-queue-drain";

export const dynamic = 'force-dynamic'; // Ensure this isn't cached
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    try {
        const configuredSecret = process.env.CRON_SECRET;
        const authorization = request.headers.get("authorization");
        const providedSecret =
            request.headers.get("x-cron-secret")
            || request.nextUrl.searchParams.get("secret")
            || (authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null);

        if (!configuredSecret || providedSecret !== configuredSecret) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const enqueued = await enqueueTrackedMangaSyncJobs();
        const processed = await drainSyncQueue(processQueuedSyncJobs);
        const queue = await getSyncQueueMetrics();
        console.info("[sync] Daily queue sweep", { ...processed, queue });
        return NextResponse.json({
            success: true,
            enqueued: enqueued.enqueued,
            ...processed,
            queue,
        });
    } catch (error) {
        console.error("Cron update failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
