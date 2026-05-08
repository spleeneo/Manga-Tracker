import { isDatabaseConfigured, prisma } from "@/lib/db";
import { getScraperStatus } from "@/lib/scrapers/registry";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  if (!isDatabaseConfigured) {
    return NextResponse.json(
      {
        status: "setup_required",
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
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      durationMs: Date.now() - startedAt,
      checks: {
        database: "ok",
      },
      providers: getScraperStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
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
