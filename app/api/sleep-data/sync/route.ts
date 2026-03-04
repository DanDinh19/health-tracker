import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOuraAccessToken } from "@/lib/oura";
import { fetchOura } from "@/lib/oura";

type OuraSleepDoc = {
  id: string;
  day: string;
  bedtime_start?: string;
  bedtime_end?: string;
  sleep_phase_5_min?: string;
  total_sleep_duration?: number;
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
  light_sleep_duration?: number;
  awake_time?: number;
  average_heart_rate?: number;
  avg_heart_rate?: number;
};

function ouraPhaseToStages(phaseStr: string): number[] {
  const stages: number[] = [];
  for (let i = 0; i < phaseStr.length; i++) {
    const c = phaseStr[i];
    const oura = c === "1" ? 3 : c === "2" ? 2 : c === "3" ? 4 : c === "4" ? 1 : 1;
    stages.push(oura);
  }
  return stages;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const auth = await getOuraAccessToken();
    if (!auth) {
      return NextResponse.json(
        { error: "Oura not connected. Connect your Oura ring first." },
        { status: 400 }
      );
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const json = await fetchOura<{ data?: OuraSleepDoc[] }>("sleep", {
      start_date: startDate,
      end_date: endDate,
    });

    const raw = json.data ?? [];
    const byDay = new Map<string, OuraSleepDoc[]>();
    for (const doc of raw) {
      const list = byDay.get(doc.day) ?? [];
      list.push(doc);
      byDay.set(doc.day, list);
    }

    let synced = 0;
    for (const [day, docs] of byDay.entries()) {
      const primary = docs[0];
      const phaseStr = primary.sleep_phase_5_min ?? "";
      const sleepStages = phaseStr.length > 0
        ? ouraPhaseToStages(phaseStr)
        : [];

      const totalSec = (primary.total_sleep_duration ?? 0);
      const awakeSec = (primary.awake_time ?? 0);

      await prisma.sleepData.upsert({
        where: {
          userId_day: { userId: user.id, day },
        },
        create: {
          userId: user.id,
          day,
          sleepStages,
          sleepScore: null,
          totalSleepTime: totalSec > 0 ? totalSec : null,
          awakeTime: awakeSec > 0 ? awakeSec : null,
          avgHr: primary.average_heart_rate ?? primary.avg_heart_rate ?? null,
          bedtimeStart: primary.bedtime_start ? new Date(primary.bedtime_start) : null,
          bedtimeEnd: primary.bedtime_end ? new Date(primary.bedtime_end) : null,
        },
        update: {
          sleepStages,
          totalSleepTime: totalSec > 0 ? totalSec : undefined,
          awakeTime: awakeSec > 0 ? awakeSec : undefined,
          avgHr: primary.average_heart_rate ?? primary.avg_heart_rate ?? undefined,
          bedtimeStart: primary.bedtime_start ? new Date(primary.bedtime_start) : undefined,
          bedtimeEnd: primary.bedtime_end ? new Date(primary.bedtime_end) : undefined,
        },
      });
      synced++;
    }

    return NextResponse.json({ synced, days: Array.from(byDay.keys()) });
  } catch (err) {
    console.error("sleep-data sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
