"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { SleepTimelineChart } from "@/components/SleepTimelineChart";

type SleepRow = {
  id: string;
  day: string;
  sleep_stages: number[];
  sleep_score: number | null;
  total_sleep_time: number | null;
  awake_time: number | null;
  avg_hr: number | null;
  bedtime_start: string | null;
  bedtime_end: string | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SleepDashboardContent() {
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");

  const [data, setData] = useState<SleepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(dayParam);

  useEffect(() => {
    setLoading(true);
    (async () => {
      await fetch("/api/sleep-data/sync", { method: "POST" }).catch(() => {});
      try {
        const res = await fetch("/api/sleep-data?days=7");
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw body;
        setData(body.data ?? []);
        setError(null);
        if (!selectedDay && body.data?.length > 0) {
          setSelectedDay(body.data[0].day);
        }
      } catch (err) {
        setError(
          typeof err === "object" && err && "error" in err
            ? String((err as { error: unknown }).error)
            : err instanceof Error
              ? err.message
              : "Failed to load sleep data"
        );
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (dayParam) setSelectedDay(dayParam);
  }, [dayParam]);

  const selectedRow = data.find((r) => r.day === selectedDay);

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Sleep Dashboard</h1>
        <p className="text-slate-500">Loading sleep data…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Sleep Dashboard</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-slate-600 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  if (data.length === 0) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Sleep Dashboard</h1>
        <p className="text-slate-600">
          No sleep data yet. Add data to the sleep_data table in Supabase.
        </p>
        <Link href="/" className="mt-4 inline-block text-slate-600 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Sleep Dashboard</h1>
        <Link
          href="/"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {data.map((r) => (
          <button
            key={r.day}
            type="button"
            onClick={() => setSelectedDay(r.day)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedDay === r.day
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {formatDate(r.day)}
          </button>
        ))}
      </div>

      {selectedRow && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">
              24-hour sleep stages — {formatDate(selectedRow.day)}
            </h2>
            {selectedRow.sleep_stages?.length > 0 ? (
              <SleepTimelineChart
                sleepStages={selectedRow.sleep_stages}
                day={selectedRow.day}
                bedtimeStart={selectedRow.bedtime_start}
              />
            ) : (
              <p className="text-slate-500 text-sm">
                No granular sleep stage data for this day.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Sleep score</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRow.sleep_score ?? "—"}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total sleep</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRow.total_sleep_time != null
                    ? `${(selectedRow.total_sleep_time / 3600).toFixed(1)} h`
                    : "—"}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Awake time</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRow.awake_time != null
                    ? `${(selectedRow.awake_time / 60).toFixed(0)} min`
                    : "—"}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Avg HR</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {selectedRow.avg_hr != null ? `${selectedRow.avg_hr} bpm` : "—"}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function SleepDashboardPage() {
  return (
    <Suspense fallback={<p className="text-slate-500 p-6">Loading…</p>}>
      <SleepDashboardContent />
    </Suspense>
  );
}
