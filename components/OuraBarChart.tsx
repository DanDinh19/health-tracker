"use client";

import { useState, useEffect } from "react";
import { ErrorWithCopy } from "./ErrorWithCopy";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const RANGES = [
  { id: "day" as const, label: "7d", days: 7 },
  { id: "week" as const, label: "2w", days: 14 },
  { id: "month" as const, label: "30d", days: 30 },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const FORMATTERS: Record<string, (v: number) => string> = {
  steps: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)),
  score: (v) => String(v),
  decimal: (v) => v.toFixed(1),
  percent: (v) => `${v}%`,
  bpm: (v) => `${v} bpm`,
  minutes: (v) => `${v} min`,
  time: (v) => {
    if (v <= 0) return "-";
    const h = Math.floor(v) % 24;
    const m = Math.round((v % 1) * 60);
    return `${h}:${m.toString().padStart(2, "0")}`;
  },
  default: (v) => String(v),
};

type OuraBarChartProps = {
  title: string;
  endpoint: string;
  dataKey: string;
  format?: "steps" | "score" | "decimal" | "percent" | "bpm" | "minutes" | "time" | "default";
  emptyMessage?: string;
};

export function OuraBarChart({
  title,
  endpoint,
  dataKey,
  format = "default",
  emptyMessage = "No data yet. Sync your ring in the Oura app.",
}: OuraBarChartProps) {
  const valueFormatter = FORMATTERS[format] ?? FORMATTERS.default;
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = RANGES.find((r) => r.id === range)?.days ?? 14;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/oura/${endpoint}?days=${days}`)
      .then((res) => {
        if (!res.ok) return res.json().then((body) => Promise.reject(body));
        return res.json();
      })
      .then((json) => {
        setData(json.data ?? []);
        setError(null);
      })
      .catch((err) => {
        setError(err?.error ?? `Failed to load ${title.toLowerCase()}`);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [days, endpoint, title]);

  if (loading) {
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 text-sm">Loading…</p>
      </section>
    );
  }

  if (error) {
    const isTokenError = error.toLowerCase().includes("reconnect");
    return (
      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">{title}</h2>
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
        <h2 className="font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 text-sm">{emptyMessage}</p>
      </section>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(String(d["day"] ?? "")),
  }));

  return (
    <section className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="font-semibold text-slate-800">{title}</h2>
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
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#64748b"
              tickFormatter={(v) => valueFormatter(Number(v))}
            />
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), title]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.day
                  ? formatDate(String(payload[0].payload.day))
                  : ""
              }
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
              }}
            />
            <Bar
              dataKey={dataKey}
              name={title}
              fill="#1e293b"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
