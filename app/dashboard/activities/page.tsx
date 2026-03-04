"use client";

import { useState, useEffect } from "react";

function ApiKeySection() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/apple-health/api-key")
      .then((r) => r.json())
      .then((d) => setApiKey(d.apiKey));
  }, []);

  async function generateKey() {
    setLoading(true);
    try {
      const res = await fetch("/api/apple-health/api-key", { method: "POST" });
      const d = await res.json();
      setApiKey(d.apiKey);
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/api/apple-health/ingest`
      : "/api/apple-health/ingest";
    const headers = apiKey ? `X-API-Key: ${apiKey}` : "";
    const text = `URL: ${url}\n${headers ? `Header: ${headers}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <p className="font-medium text-slate-800">Ingest URL</p>
      <p className="font-mono text-xs break-all">
        {typeof window !== "undefined" ? window.location.origin : ""}
        /api/apple-health/ingest
      </p>
      <div className="flex gap-2 items-center">
        {apiKey ? (
          <>
            <p className="text-xs">
              API key: <span className="font-mono">{apiKey.slice(0, 8)}…</span>
            </p>
            <button
              type="button"
              onClick={generateKey}
              className="text-xs text-slate-600 hover:text-slate-800 underline"
            >
              Regenerate
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={generateKey}
            disabled={loading}
            className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700"
          >
            {loading ? "Generating…" : "Generate API key"}
          </button>
        )}
        <button
          type="button"
          onClick={copyUrl}
          className="text-xs text-slate-600 hover:text-slate-800 underline"
        >
          {copied ? "Copied!" : "Copy URL + key"}
        </button>
      </div>
    </div>
  );
}
import Link from "next/link";

type Workout = {
  id: string;
  activityType: string;
  startDate: string;
  endDate: string;
  duration?: number;
  calories?: number;
  distance?: number;
  sourceName?: string;
};

type ActivitySummary = {
  id: string;
  date: string;
  activeEnergy?: number;
  exerciseMinutes?: number;
  standHours?: number;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m} min`;
}

export default function ActivitiesPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/apple-health/activities?type=workouts&days=14").then((r) => r.json()),
      fetch("/api/apple-health/activities?type=summaries&days=14").then((r) => r.json()),
    ])
      .then(([wRes, sRes]) => {
        setWorkouts(wRes.workouts ?? []);
        setSummaries(sRes.activitySummaries ?? []);
        setError(null);
      })
      .catch((err) => {
        setError(err?.message ?? "Failed to load activities");
        setWorkouts([]);
        setSummaries([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Activities</h1>
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Activities</h1>
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-slate-600 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Activities</h1>
        <Link
          href="/"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium"
        >
          ← Dashboard
        </Link>
      </div>

      <p className="text-slate-600 text-sm mb-6">
        Workouts and activity summaries from Apple Health (Watch & iPhone).
      </p>

      {summaries.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-slate-800 mb-3">Activity rings (last 14 days)</h2>
          <div className="flex flex-wrap gap-4">
            {summaries.map((s) => (
              <div
                key={s.id}
                className="bg-slate-50 rounded-lg p-4 min-w-[140px]"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  {formatDate(s.date + "T12:00:00")}
                </p>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {s.activeEnergy != null ? `${Math.round(s.activeEnergy)} kcal` : "—"}
                </p>
                <p className="text-sm text-slate-600">
                  {s.exerciseMinutes != null ? `${s.exerciseMinutes} min exercise` : ""}
                  {s.standHours != null ? ` · ${s.standHours}h stand` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-slate-800 mb-3">Workouts</h2>
        {workouts.length === 0 ? (
          <p className="text-slate-500 text-sm">No workouts yet.</p>
        ) : (
          <ul className="space-y-3">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="bg-white rounded-lg shadow p-4 border border-slate-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-800">{w.activityType}</p>
                    <p className="text-sm text-slate-600">
                      {formatDate(w.startDate)} at {formatTime(w.startDate)}
                    </p>
                    {w.sourceName && (
                      <p className="text-xs text-slate-500 mt-1">{w.sourceName}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    {w.duration != null && (
                      <p className="font-medium text-slate-800">
                        {formatDuration(w.duration)}
                      </p>
                    )}
                    {w.calories != null && (
                      <p className="text-slate-600">{Math.round(w.calories)} kcal</p>
                    )}
                    {w.distance != null && w.distance > 0 && (
                      <p className="text-slate-600">
                        {(w.distance / 1000).toFixed(2)} km
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-medium text-slate-800 mb-2">How to sync Apple Health data</p>
          <p>
            Use an app like <strong>Health Auto Export</strong> or{" "}
            <strong>HealthyApps</strong> to send your Health data here. Configure the
            app with your ingest URL and API key below.
          </p>
        </div>
        <ApiKeySection />
      </div>
    </main>
  );
}
