"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErrorWithCopy } from "./ErrorWithCopy";
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
  date: string;
  totalHours: number;
  deepHours: number;
  remHours: number;
  lightHours: number;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const RANGES = [
  { id: "day" as const, label: "Day", days: 7 },
  { id: "week" as const, label: "Week", days: 14 },
  { id: "month" as const, label: "Month", days: 30 },
];

export function SleepChart() {
  const router = useRouter();
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [data, setData] = useState<SleepDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = RANGES.find((r) => r.id === range)?.days ?? 14;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/oura/sleep?days=${days}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return Promise.reject(body);
        return body;
      })
      .then((json) => {
        setData(json.data ?? []);
        setError(null);
      })
      .catch((err) => {
        const msg = typeof err?.error === "string" ? err.error : err?.message ?? "Failed to load sleep data";
        setError(msg);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep (Oura)</h2>
        <p className="text-slate-500 text-sm">Loading sleep data…</p>
      </section>
    );
  }

  if (error) {
    const isTokenError = error.toLowerCase().includes("reconnect");
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep (Oura)</h2>
        <ErrorWithCopy message={error} title="Error" />
        {isTokenError && (
          <a
            href="/api/oura/connect"
            className="mt-3 inline-block bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            Reconnect Oura
          </a>
        )}
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Sleep (Oura)</h2>
        <p className="text-slate-500 text-sm">
          No sleep data yet. Sync your ring in the Oura app, then refresh.
        </p>
      </section>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.day),
  }));

  return (
    <section className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="font-semibold text-slate-800">Sleep (Oura)</h2>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                range === r.id
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-slate-600 text-sm mb-4">
        Total sleep hours per night — click a bar for 24h timeline
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
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
                    <p className="font-medium text-slate-800 mb-2">{formatDate(p.day)}</p>
                    <p className="text-slate-600">Total: {p.totalHours.toFixed(1)} h</p>
                    <p className="text-slate-600">Deep: {p.deepHours.toFixed(1)} h · REM: {p.remHours.toFixed(1)} h · Light: {p.lightHours.toFixed(1)} h</p>
                    <p className="text-slate-500 text-xs mt-1">Click bar for 24h timeline</p>
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
              {chartData.map((entry) => (
                <Cell
                  key={entry.day}
                  onClick={() => router.push(`/sleep/${entry.day}`)}
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
