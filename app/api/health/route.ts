import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health – list health entries for the current user (optional: ?type=weight to filter)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const entries = await prisma.healthEntry.findMany({
      where: {
        userId: user.id,
        ...(type ? { type } : {}),
      },
      orderBy: { recordedAt: "desc" },
      take: 100,
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/health error:", error);
    return NextResponse.json(
      { error: "Failed to fetch health entries" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health – create a new health entry for the current user
 * Body: { type: string, value: number, unit?: string, recordedAt?: string, note?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await request.json();
    const { type, value, unit, recordedAt, note } = body;

    if (!type || typeof value !== "number") {
      return NextResponse.json(
        { error: "type (string) and value (number) are required" },
        { status: 400 }
      );
    }

    const data: {
      userId: string;
      type: string;
      value: number;
      unit: string | null;
      recordedAt?: Date;
      note: string | null;
    } = {
      userId: user.id,
      type: String(type).trim(),
      value: Number(value),
      unit: unit ? String(unit).trim() : null,
      note: note ? String(note).trim() : null,
    };
    if (recordedAt) {
      const d = new Date(recordedAt);
      if (!Number.isNaN(d.getTime())) data.recordedAt = d;
    }

    const entry = await prisma.healthEntry.create({
      data,
    });
    return NextResponse.json(entry);
  } catch (error) {
    console.error("POST /api/health error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create health entry";
    return NextResponse.json(
      { error: "Failed to create health entry", details: message },
      { status: 500 }
    );
  }
}
