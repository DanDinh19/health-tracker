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
  const days = Math.min(parseInt(searchParams.get("days") ?? "14", 10) || 14, 90);
  const type = searchParams.get("type"); // workouts | records | summaries | all

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = start;

  try {
    const result: {
      workouts?: unknown[];
      records?: unknown[];
      activitySummaries?: unknown[];
    } = {};

    if (!type || type === "workouts" || type === "all") {
      const workouts = await prisma.appleHealthWorkout.findMany({
        where: { userId: user.id, startDate: { gte: startDate } },
        orderBy: { startDate: "desc" },
      });
      result.workouts = workouts.map((w) => ({
        id: w.id,
        activityType: w.activityType,
        startDate: w.startDate.toISOString(),
        endDate: w.endDate.toISOString(),
        duration: w.duration,
        calories: w.calories,
        distance: w.distance,
        sourceName: w.sourceName,
      }));
    }

    if (!type || type === "records" || type === "all") {
      const records = await prisma.appleHealthRecord.findMany({
        where: { userId: user.id, startDate: { gte: startDate } },
        orderBy: { startDate: "desc" },
        take: 500,
      });
      result.records = records.map((r) => ({
        id: r.id,
        type: r.type,
        value: r.value,
        unit: r.unit,
        startDate: r.startDate.toISOString(),
        sourceName: r.sourceName,
      }));
    }

    if (!type || type === "summaries" || type === "all") {
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const summaries = await prisma.appleHealthActivitySummary.findMany({
        where: {
          userId: user.id,
          date: { gte: startStr, lte: endStr },
        },
        orderBy: { date: "desc" },
      });
      result.activitySummaries = summaries.map((s) => ({
        id: s.id,
        date: s.date,
        activeEnergy: s.activeEnergy,
        exerciseMinutes: s.exerciseMinutes,
        standHours: s.standHours,
      }));
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Apple Health activities fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
