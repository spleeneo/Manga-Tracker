import { enqueueTrackedMangaSyncJobs, processQueuedSyncJobs } from "@/lib/sync-jobs";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Ensure this isn't cached

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
        const processed = await processQueuedSyncJobs({ limit: 20, concurrency: 4 });
        return NextResponse.json({
            success: true,
            enqueued: enqueued.enqueued,
            ...processed,
        });
    } catch (error) {
        console.error("Cron update failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
