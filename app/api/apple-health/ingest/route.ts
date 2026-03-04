import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type WorkoutPayload = {
  activityType: string;
  startDate: string;
  endDate: string;
  duration?: number;
  calories?: number;
  distance?: number;
  sourceName?: string;
  sourceId?: string;
};

type RecordPayload = {
  type: string;
  value: number;
  unit?: string;
  startDate: string;
  endDate?: string;
  sourceName?: string;
  sourceId?: string;
};

type ActivitySummaryPayload = {
  date: string;
  activeEnergy?: number;
  exerciseMinutes?: number;
  standHours?: number;
};

type IngestPayload = {
  apiKey?: string;
  workouts?: WorkoutPayload[];
  records?: RecordPayload[];
  activitySummaries?: ActivitySummaryPayload[];
};

async function getUserId(request: NextRequest): Promise<string | null> {
  const apiKey = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("apiKey");
  if (apiKey) {
    const u = await prisma.user.findFirst({
      where: { appleHealthApiKey: apiKey },
      select: { id: true },
    });
    return u?.id ?? null;
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user.id;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as IngestPayload;
    const { workouts = [], records = [], activitySummaries = [] } = body;

    let workoutCount = 0;
    let recordCount = 0;
    let summaryCount = 0;

    for (const w of workouts) {
      const startDate = new Date(w.startDate);
      const endDate = new Date(w.endDate);
      const duration = w.duration ?? Math.round((endDate.getTime() - startDate.getTime()) / 1000);

      await prisma.appleHealthWorkout.create({
        data: {
          userId: userId,
          activityType: w.activityType || "Workout",
          startDate,
          endDate,
          duration,
          calories: w.calories ?? undefined,
          distance: w.distance ?? undefined,
          sourceName: w.sourceName ?? undefined,
          sourceId: w.sourceId ?? undefined,
        },
      });
      workoutCount++;
    }

    for (const r of records) {
      await prisma.appleHealthRecord.create({
        data: {
          userId: userId,
          type: r.type,
          value: r.value,
          unit: r.unit ?? undefined,
          startDate: new Date(r.startDate),
          endDate: r.endDate ? new Date(r.endDate) : undefined,
          sourceName: r.sourceName ?? undefined,
          sourceId: r.sourceId ?? undefined,
        },
      });
      recordCount++;
    }

    for (const s of activitySummaries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) continue;
      await prisma.appleHealthActivitySummary.upsert({
        where: { userId_date: { userId: userId, date: s.date } },
        create: {
          userId: userId,
          date: s.date,
          activeEnergy: s.activeEnergy ?? undefined,
          exerciseMinutes: s.exerciseMinutes ?? undefined,
          standHours: s.standHours ?? undefined,
        },
        update: {
          activeEnergy: s.activeEnergy ?? undefined,
          exerciseMinutes: s.exerciseMinutes ?? undefined,
          standHours: s.standHours ?? undefined,
        },
      });
      summaryCount++;
    }

    return NextResponse.json({
      ok: true,
      ingested: { workouts: workoutCount, records: recordCount, activitySummaries: summaryCount },
    });
  } catch (err) {
    console.error("Apple Health ingest error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
