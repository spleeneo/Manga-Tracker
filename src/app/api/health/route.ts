import { isDatabaseConfigured, prisma } from "@/lib/db";
import { getScraperStatus } from "@/lib/scrapers/registry";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function GET() {
  const startedAt = Date.now();
  const region = process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? "local";
  if (!isDatabaseConfigured) {
    return NextResponse.json(
      {
        status: "setup_required",
        region,
        durationMs: Date.now() - startedAt,
        checks: {
          database: "missing_DATABASE_URL",
        },
        providers: getScraperStatus(),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    const dbStartedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const databaseDurationMs = Date.now() - dbStartedAt;
    return NextResponse.json({
      status: "ok",
      region,
      uptimeSeconds: Math.floor(process.uptime()),
      durationMs: Date.now() - startedAt,
      checks: {
        database: "ok",
        databaseDurationMs,
      },
      providers: getScraperStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        region,
        durationMs: Date.now() - startedAt,
        checks: {
          database: "error",
        },
        providers: getScraperStatus(),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
