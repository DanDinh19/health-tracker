import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "7", 10) || 7, 90);
  const dayParam = searchParams.get("day");

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const rows = await prisma.sleepData.findMany({
      where: {
        userId: user.id,
        ...(dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)
          ? { day: dayParam }
          : { day: { gte: startDate, lte: endDate } }),
      },
      orderBy: { day: "desc" },
    });

    const data = rows.map((r) => ({
      id: r.id,
      day: r.day,
      sleep_stages: r.sleepStages ?? [],
      sleep_score: r.sleepScore,
      total_sleep_time: r.totalSleepTime,
      awake_time: r.awakeTime,
      avg_hr: r.avgHr != null ? Number(r.avgHr) : null,
      bedtime_start: r.bedtimeStart?.toISOString() ?? null,
      bedtime_end: r.bedtimeEnd?.toISOString() ?? null,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("sleep_data fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sleep data" },
      { status: 500 }
    );
  }
}
