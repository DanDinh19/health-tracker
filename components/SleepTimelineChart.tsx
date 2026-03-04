"use client";

const STAGE_COLORS: Record<number, string> = {
  1: "#4CAF50", // Awake
  2: "#4FC3F7", // Light
  3: "#01579B", // Deep
  4: "#0288D1", // REM
};

const STAGE_LABELS: Record<number, string> = {
  1: "Awake",
  2: "Light",
  3: "Deep",
  4: "REM",
};

function formatTime(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

type Interval = {
  start: number;
  end: number;
  stage: number;
};

function stagesToIntervals(
  sleepStages: number[],
  bedtimeStart: Date | null,
  day: string
): Interval[] {
  const dayDate = new Date(day + "T12:00:00");
  const dayStartMs = new Date(dayDate).setHours(0, 0, 0, 0);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const BLOCK_MS = 5 * 60 * 1000;

  const intervals: Interval[] = [];
  const startMs = bedtimeStart?.getTime() ?? dayStartMs;

  for (let i = 0; i < sleepStages.length; i++) {
    const stage = sleepStages[i];
    if (!stage || stage < 1 || stage > 4) continue;

    const intervalStart = startMs + i * BLOCK_MS;
    const intervalEnd = intervalStart + BLOCK_MS;

    if (intervalEnd <= dayStartMs || intervalStart >= dayEndMs) continue;

    const clipStart = Math.max(intervalStart, dayStartMs);
    const clipEnd = Math.min(intervalEnd, dayEndMs);
    const startMin = (clipStart - dayStartMs) / (60 * 1000);
    const endMin = (clipEnd - dayStartMs) / (60 * 1000);

    intervals.push({ start: startMin, end: endMin, stage });
  }

  return intervals;
}

export function SleepTimelineChart({
  sleepStages,
  day,
  bedtimeStart,
}: {
  sleepStages: number[];
  day: string;
  bedtimeStart?: string | null;
}) {
  const bedtime = bedtimeStart ? new Date(bedtimeStart) : null;
  const intervals = stagesToIntervals(sleepStages, bedtime, day);

  const MINUTES_PER_DAY = 24 * 60;
  const BLOCK_MINUTES = 5;
  const blocks = Math.ceil(MINUTES_PER_DAY / BLOCK_MINUTES);
  const timeline: number[] = Array(blocks).fill(1);

  for (const iv of intervals) {
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
        {[1, 2, 3, 4].map((code) => (
          <span key={code} className="flex items-center gap-2 text-sm">
            <span
              className="w-4 h-4 rounded"
              style={{ backgroundColor: STAGE_COLORS[code] }}
            />
            {STAGE_LABELS[code]}
          </span>
        ))}
      </div>
    </div>
  );
}
