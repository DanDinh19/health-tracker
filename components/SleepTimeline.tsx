"use client";

const STAGE_COLORS: Record<string, string> = {
  "1": "#01579B", // deep
  "2": "#4FC3F7", // light
  "3": "#0288D1", // REM
  "4": "#4CAF50", // awake
};

const STAGE_LABELS: Record<string, string> = {
  "1": "Deep",
  "2": "Light",
  "3": "REM",
  "4": "Awake",
};

type Interval = {
  start: number; // minutes from midnight
  end: number;
  stage: string;
};

function formatTime(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parsePhaseString(
  phaseStr: string,
  bedtimeStart: Date,
  dayDate: Date
): Interval[] {
  const intervals: Interval[] = [];
  const MS_PER_5_MIN = 5 * 60 * 1000;
  const dayStartMs = new Date(dayDate).setHours(0, 0, 0, 0);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  for (let i = 0; i < phaseStr.length; i++) {
    const stage = phaseStr[i];
    if (!stage || !STAGE_COLORS[stage]) continue;

    const intervalStart = bedtimeStart.getTime() + i * MS_PER_5_MIN;
    const intervalEnd = intervalStart + MS_PER_5_MIN;

    if (intervalEnd <= dayStartMs || intervalStart >= dayEndMs) continue;

    const clipStart = Math.max(intervalStart, dayStartMs);
    const clipEnd = Math.min(intervalEnd, dayEndMs);
    const startMinute = (clipStart - dayStartMs) / (60 * 1000);
    const endMinute = (clipEnd - dayStartMs) / (60 * 1000);

    intervals.push({ start: startMinute, end: endMinute, stage });
  }
  return intervals;
}

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

function buildFallbackIntervals(
  bedtimeStart: Date,
  bedtimeEnd: Date,
  deepSec: number,
  remSec: number,
  lightSec: number,
  awakeSec: number,
  dayDate: Date
): Interval[] {
  if (!isValidDate(bedtimeStart) || !isValidDate(bedtimeEnd) || !isValidDate(dayDate)) {
    return [];
  }
  const dayStartMs = new Date(dayDate).setHours(0, 0, 0, 0);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const sleepStart = bedtimeStart.getTime();
  const sleepEnd = bedtimeEnd.getTime();
  const totalSec = deepSec + remSec + lightSec + awakeSec;
  if (totalSec <= 0 || sleepEnd <= sleepStart) return [];

  const order: { stage: string; sec: number }[] = [
    { stage: "1", sec: deepSec },
    { stage: "3", sec: remSec },
    { stage: "2", sec: lightSec },
    { stage: "4", sec: awakeSec },
  ].filter((x) => x.sec > 0);

  const intervals: Interval[] = [];
  let offsetSec = 0;
  for (const { stage, sec } of order) {
    const segStart = sleepStart + (offsetSec / totalSec) * (sleepEnd - sleepStart);
    const segEnd = sleepStart + ((offsetSec + sec) / totalSec) * (sleepEnd - sleepStart);
    offsetSec += sec;

    if (segEnd <= dayStartMs || segStart >= dayEndMs) continue;
    const clipStart = Math.max(segStart, dayStartMs);
    const clipEnd = Math.min(segEnd, dayEndMs);
    const startMin = (clipStart - dayStartMs) / (60 * 1000);
    const endMin = (clipEnd - dayStartMs) / (60 * 1000);
    intervals.push({ start: startMin, end: endMin, stage });
  }
  return intervals;
}

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

export function SleepTimeline({
  data,
  day,
}: {
  data: SleepDoc[];
  day: string;
}) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return (
      <div className="text-slate-500 text-sm">Invalid date.</div>
    );
  }

  const dayDate = new Date(day + "T12:00:00");
  if (!isValidDate(dayDate)) {
    return (
      <div className="text-slate-500 text-sm">Invalid date format.</div>
    );
  }

  let allIntervals: Interval[] = [];
  for (const doc of data) {
    const phaseStr = doc.sleep_phase_5_min;
    const bedtimeStart = doc.bedtime_start ? new Date(doc.bedtime_start) : null;
    const bedtimeEnd = doc.bedtime_end ? new Date(doc.bedtime_end) : null;

    if (phaseStr && bedtimeStart && isValidDate(bedtimeStart)) {
      const parsed = parsePhaseString(phaseStr, bedtimeStart, dayDate);
      allIntervals.push(...parsed);
    } else if (bedtimeStart && bedtimeEnd && isValidDate(bedtimeStart) && isValidDate(bedtimeEnd)) {
      const deep = doc.deep_sleep_duration ?? 0;
      const rem = doc.rem_sleep_duration ?? 0;
      const light = doc.light_sleep_duration ?? 0;
      const awake = doc.awake_time ?? 0;
      const fallback = buildFallbackIntervals(
        bedtimeStart,
        bedtimeEnd,
        deep,
        rem,
        light,
        awake,
        dayDate
      );
      allIntervals.push(...fallback);
    }
  }

  allIntervals = allIntervals.filter(
    (iv) => !isNaN(iv.start) && !isNaN(iv.end) && iv.start < iv.end
  );
  allIntervals.sort((a, b) => a.start - b.start);

  const MINUTES_PER_DAY = 24 * 60;
  const BLOCK_MINUTES = 5;
  const blocks = Math.ceil(MINUTES_PER_DAY / BLOCK_MINUTES);
  const timeline: string[] = Array(blocks).fill("4");

  for (const iv of allIntervals) {
    const startBlock = Math.floor(iv.start / BLOCK_MINUTES);
    const endBlock = Math.ceil(iv.end / BLOCK_MINUTES);
    for (let b = startBlock; b < endBlock && b < blocks; b++) {
      timeline[b] = iv.stage;
    }
  }

  const fullIntervals: Interval[] = [];
  let i = 0;
  while (i < blocks) {
    const stage = timeline[i];
    const start = i * BLOCK_MINUTES;
    let end = start + BLOCK_MINUTES;
    while (i + 1 < blocks && timeline[i + 1] === stage) {
      i++;
      end += BLOCK_MINUTES;
    }
    fullIntervals.push({ start, end, stage });
    i++;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2 text-xs text-slate-500 px-0.5">
        {Array.from({ length: 13 }, (_, i) => (
          <span key={i}>{formatTime(i * 120)}</span>
        ))}
      </div>
      <div className="relative h-16 rounded-lg overflow-hidden">
        {fullIntervals.map((iv, i) => {
          const widthPct = ((iv.end - iv.start) / MINUTES_PER_DAY) * 100;
          const showLabel = widthPct >= 4;
          return (
            <div
              key={i}
              className="absolute h-full rounded-sm transition-opacity hover:opacity-90 flex items-center justify-center"
              style={{
                left: `${(iv.start / MINUTES_PER_DAY) * 100}%`,
                width: `${widthPct}%`,
                backgroundColor: STAGE_COLORS[iv.stage] ?? "#94a3b8",
                minWidth: "2px",
              }}
              title={`${STAGE_LABELS[iv.stage] ?? "Sleep"}: ${formatTime(iv.start)} - ${formatTime(iv.end)}`}
            >
              {showLabel && (
                <span className="text-[10px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] truncate px-0.5 text-center">
                  {STAGE_LABELS[iv.stage] ?? "Sleep"} {formatTime(iv.start)}–{formatTime(iv.end)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        {Object.entries(STAGE_LABELS).map(([code, label]) => (
          <span key={code} className="flex items-center gap-2 text-sm">
            <span
              className="w-4 h-4 rounded"
              style={{ backgroundColor: STAGE_COLORS[code] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
