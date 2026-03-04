"use client";

import { useState, useEffect } from "react";
import { ErrorWithCopy } from "./ErrorWithCopy";

type HealthEntry = {
  id: string;
  type: string;
  value: number;
  unit: string | null;
  recordedAt: string;
  note: string | null;
};

const DEFAULT_TYPES = [
  { type: "weight", unit: "lbs", label: "Weight (lbs)" },
  { type: "steps", unit: "steps", label: "Steps" },
  { type: "mood", unit: "1-10", label: "Mood (1-10)" },
  { type: "sleep_hours", unit: "hours", label: "Sleep (hours)" },
];

export function HealthTrackerClient() {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState("weight");
  const [value, setValue] = useState("");
  const [recordedDate, setRecordedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentSpec = DEFAULT_TYPES.find((t) => t.type === selectedType) ?? DEFAULT_TYPES[0];

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          value: num,
          unit: currentSpec.unit,
          recordedAt: recordedDate ? `${recordedDate}T12:00:00.000Z` : undefined,
          note: note.trim() || undefined,
        }),
      });
      const body = await res.text();
      if (res.ok) {
        setValue("");
        setRecordedDate(new Date().toISOString().slice(0, 10));
        setNote("");
        setSaveError(null);
        await loadEntries();
      } else {
        let errMessage: string;
        try {
          const err = JSON.parse(body);
          errMessage = `Status: ${res.status}\n${err.error || "Failed to save"}${err.details ? "\n\nDetails: " + err.details : ""}`;
        } catch {
          errMessage = `Status: ${res.status}\n${body || "Failed to save"}`;
        }
        setSaveError(errMessage);
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setSaveError(`Network/request error:\n${errMessage}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Add entry</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Metric</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            >
              {DEFAULT_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={recordedDate}
              onChange={(e) => setRecordedDate(e.target.value)}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Value</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentSpec.unit}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. After morning run"
              className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-800 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save entry"}
          </button>
          {saveError && (
            <div className="mt-3">
              <ErrorWithCopy message={saveError} title="Error" />
            </div>
          )}
        </form>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Recent entries</h2>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-500">No entries yet. Add one above.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="text-sm border-b border-slate-100 pb-2 last:border-0"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-800">
                    {entry.type}: {entry.value}
                    {entry.unit ? ` ${entry.unit}` : ""}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {new Date(entry.recordedAt).toLocaleString()}
                  </span>
                </div>
                {entry.note && (
                  <p className="mt-1 text-slate-600 text-xs">{entry.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
