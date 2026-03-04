"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { SleepTimeline } from "@/components/SleepTimeline";
import { ErrorWithCopy } from "@/components/ErrorWithCopy";

type SleepDoc = {
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
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SleepTimelinePage() {
  const params = useParams();
  const day = typeof params.day === "string" ? params.day : null;

  const [data, setData] = useState<SleepDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Invalid date");
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/oura/sleep-detail?day=${day}`)
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
        const msg =
          typeof err?.error === "string"
            ? err.error
            : err?.message ?? "Failed to load sleep data";
        setError(msg);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [day]);

  if (!day) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-slate-600">Missing date.</p>
        <Link href="/" className="text-slate-600 hover:underline mt-2 inline-block">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          Sleep timeline — {formatDate(day)}
        </h1>
        <p className="text-slate-500">Loading sleep data…</p>
      </main>
    );
  }

  if (error) {
    const isTokenError = error.toLowerCase().includes("reconnect");
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          Sleep timeline — {formatDate(day)}
        </h1>
        <ErrorWithCopy message={error} title="Error" />
        {isTokenError && (
          <a
            href="/api/oura/connect"
            className="mt-3 inline-block bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            Reconnect Oura
          </a>
        )}
        <Link
          href="/"
          className="mt-4 inline-block text-slate-600 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const totalDeep = data.reduce((s, d) => s + (d.deep_sleep_duration ?? 0), 0);
  const totalRem = data.reduce((s, d) => s + (d.rem_sleep_duration ?? 0), 0);
  const totalLight = data.reduce((s, d) => s + (d.light_sleep_duration ?? 0), 0);
  const totalAwake = data.reduce((s, d) => s + (d.awake_time ?? 0), 0);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">
          Sleep timeline — {formatDate(day)}
        </h1>
        <Link
          href="/"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium"
        >
          ← Dashboard
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600">
            No sleep data for this day. Sync your ring in the Oura app and try
            again.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">
              24-hour sleep stages
            </h2>
            <SleepTimeline data={Array.isArray(data) ? data : []} day={day} />
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3">Summary</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-600">Deep sleep</dt>
              <dd className="font-medium text-slate-800">
                {(totalDeep / 3600).toFixed(1)} h
              </dd>
              <dt className="text-slate-600">REM sleep</dt>
              <dd className="font-medium text-slate-800">
                {(totalRem / 3600).toFixed(1)} h
              </dd>
              <dt className="text-slate-600">Light sleep</dt>
              <dd className="font-medium text-slate-800">
                {(totalLight / 3600).toFixed(1)} h
              </dd>
              <dt className="text-slate-600">Awake</dt>
              <dd className="font-medium text-slate-800">
                {(totalAwake / 3600).toFixed(1)} h
              </dd>
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
