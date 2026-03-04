"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SleepDay = {
  day: string;
  totalHours: number;
  label: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SleepChartFromData() {
  const router = useRouter();
  const [data, setData] = useState<SleepDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      await fetch("/api/sleep-data/sync", { method: "POST" }).catch(() => {});
      try {
        const res = await fetch("/api/sleep-data?days=7");
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw body;
        const rows = body.data ?? [];
        const chartData = rows
          .map((r: { day: string; total_sleep_time?: number | null }) => ({
            day: r.day,
            totalHours: (r.total_sleep_time ?? 0) / 3600,
            label: formatDate(r.day),
          }))
          .filter((d: SleepDay) => d.totalHours > 0)
          .sort((a: SleepDay, b: SleepDay) => a.day.localeCompare(b.day));
        setData(chartData);
        setError(null);
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

  if (loading) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep</h2>
        <p className="text-slate-500 text-sm">Loading sleep data…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep</h2>
        <p className="text-red-600 text-sm">{error}</p>
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep</h2>
        <p className="text-slate-500 text-sm">
          No sleep data yet. Add data to the sleep_data table.
        </p>
        <a
          href="/dashboard/sleep"
          className="mt-2 inline-block text-slate-600 hover:underline text-sm"
        >
          Open Sleep Dashboard →
        </a>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="font-semibold text-slate-800">Sleep</h2>
        <a
          href="/dashboard/sleep"
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          Full dashboard →
        </a>
      </div>
      <p className="text-slate-600 text-sm mb-4">
        Total sleep hours — click a bar for granular timeline
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              stroke="#64748b"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#64748b"
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]?.payload) return null;
                const p = payload[0].payload as SleepDay;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium text-slate-800 mb-2">{p.label}</p>
                    <p className="text-slate-600">Total: {p.totalHours.toFixed(1)} h</p>
                    <p className="text-slate-500 text-xs mt-1">Click bar for granular timeline</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="totalHours"
              name="Total sleep"
              fill="#1e293b"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  onClick={() => router.push(`/dashboard/sleep?day=${entry.day}`)}
                  cursor="pointer"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
