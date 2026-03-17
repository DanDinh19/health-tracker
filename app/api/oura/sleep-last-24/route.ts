import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import {
  getOuraAccessTokenForUser,
  fetchOuraForUser,
} from "@/lib/oura";

type SleepDoc = {
  id: string;
  day: string;
  bedtime_start?: string;
  bedtime_end?: string;
  sleep_phase_5_min?: string;
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
  light_sleep_duration?: number;
  awake_time?: number;
};

/** 5-min block in last 24h: 0 = 24h ago, 287 = now. stage: 1=deep, 2=light, 3=REM, 4=awake, 0=no data */
export type SleepBlock = {
  index: number;
  startMinute: number;
  endMinute: number;
  stage: number;
};

function parseSleepToLast24Blocks(docs: SleepDoc[], now: Date): SleepBlock[] {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const MS_PER_5_MIN = 5 * 60 * 1000;
  const blocks: SleepBlock[] = [];
  for (let i = 0; i < 288; i++) {
    const blockStart = new Date(
      windowStart.getTime() + i * MS_PER_5_MIN
    );
    const blockEnd = new Date(blockStart.getTime() + MS_PER_5_MIN);
    blocks.push({
      index: i,
      startMinute: i * 5,
      endMinute: (i + 1) * 5,
      stage: 0,
    });
  }

  for (const doc of docs) {
    const phaseStr = doc.sleep_phase_5_min;
    const bedtimeStart = doc.bedtime_start
      ? new Date(doc.bedtime_start)
      : null;
    const bedtimeEnd = doc.bedtime_end ? new Date(doc.bedtime_end) : null;

    if (phaseStr && bedtimeStart && !isNaN(bedtimeStart.getTime())) {
      for (let i = 0; i < phaseStr.length; i++) {
        const stageChar = phaseStr[i];
        const stage = stageChar ? parseInt(stageChar, 10) : 0;
        if (stage < 1 || stage > 4) continue;

        const intervalStart = new Date(
          bedtimeStart.getTime() + i * MS_PER_5_MIN
        );
        const intervalEnd = new Date(
          intervalStart.getTime() + MS_PER_5_MIN
        );

        if (intervalEnd <= windowStart || intervalStart >= now) continue;

        for (let b = 0; b < 288; b++) {
          const blockStart = new Date(
            windowStart.getTime() + b * MS_PER_5_MIN
          );
          const blockEnd = new Date(
            blockStart.getTime() + MS_PER_5_MIN
          );
          if (intervalStart < blockEnd && intervalEnd > blockStart) {
            blocks[b].stage = stage;
          }
        }
      }
    } else if (
      bedtimeStart &&
      bedtimeEnd &&
      !isNaN(bedtimeStart.getTime()) &&
      !isNaN(bedtimeEnd.getTime())
    ) {
      const totalSec =
        (doc.deep_sleep_duration ?? 0) +
        (doc.rem_sleep_duration ?? 0) +
        (doc.light_sleep_duration ?? 0) +
        (doc.awake_time ?? 0);
      if (totalSec <= 0 || bedtimeEnd <= bedtimeStart) continue;

      const sleepStart = bedtimeStart.getTime();
      const sleepEnd = bedtimeEnd.getTime();
      const order: { stage: number; sec: number }[] = [
        { stage: 1, sec: doc.deep_sleep_duration ?? 0 },
        { stage: 3, sec: doc.rem_sleep_duration ?? 0 },
        { stage: 2, sec: doc.light_sleep_duration ?? 0 },
        { stage: 4, sec: doc.awake_time ?? 0 },
      ].filter((x) => x.sec > 0);

      let offsetSec = 0;
      for (const { stage, sec } of order) {
        const segStart =
          sleepStart + (offsetSec / totalSec) * (sleepEnd - sleepStart);
        const segEnd =
          sleepStart +
          ((offsetSec + sec) / totalSec) * (sleepEnd - sleepStart);
        offsetSec += sec;

        const windowStartMs = windowStart.getTime();
        const nowMs = now.getTime();
        if (segEnd <= windowStartMs || segStart >= nowMs) continue;

        for (let b = 0; b < 288; b++) {
          const blockStartMs = windowStartMs + b * MS_PER_5_MIN;
          const blockEndMs = blockStartMs + MS_PER_5_MIN;
          if (segStart < blockEndMs && segEnd > blockStartMs) {
            blocks[b].stage = stage;
          }
        }
      }
    }
  }

  return blocks;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  try {
    const auth = await getOuraAccessTokenForUser(userId);
    if (!auth) {
      return NextResponse.json(
        { error: "Oura not connected. Connect your Oura ring in the web app first." },
        { status: 400 }
      );
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const json = await fetchOuraForUser<{ data?: SleepDoc[] }>(
      userId,
      auth.token,
      "sleep",
      { start_date: yesterdayStr, end_date: today }
    );

    const raw = json.data ?? [];
    const blocks = parseSleepToLast24Blocks(raw, now);

    return NextResponse.json({
      blocks,
      windowStart: now.getTime() - 24 * 60 * 60 * 1000,
      windowEnd: now.getTime(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch Oura sleep data";
    console.error("Oura sleep-last-24 error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
