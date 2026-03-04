import { Suspense } from "react";
import { HealthTrackerClient } from "@/components/HealthTrackerClient";
import { OuraConnect } from "@/components/OuraConnect";
import { SleepChartFromData } from "@/components/SleepChartFromData";
import { OuraBarChart } from "@/components/OuraBarChart";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Health Tracker</h1>
      <p className="text-slate-600 mb-6">
        Log weight, steps, mood, sleep, or any metric. Data is stored in your PostgreSQL database.
      </p>
      <Suspense fallback={null}>
        <OuraConnect />
      </Suspense>
      <SleepChartFromData />
      <div className="mb-6">
        <a
          href="/dashboard/activities"
          className="inline-block bg-white rounded-lg shadow px-4 py-3 text-slate-800 font-medium hover:bg-slate-50 border border-slate-200"
        >
          Apple Health Activities →
        </a>
      </div>
      <OuraBarChart
        title="Activity (Steps)"
        endpoint="activity"
        dataKey="steps"
        format="steps"
      />
      <OuraBarChart
        title="Readiness Score"
        endpoint="readiness"
        dataKey="score"
        format="score"
      />
      <OuraBarChart
        title="Sleep Score"
        endpoint="sleep-score"
        dataKey="score"
        format="score"
      />
      <OuraBarChart
        title="SpO2 (Blood Oxygen)"
        endpoint="spo2"
        dataKey="spo2"
        format="percent"
        emptyMessage="No SpO2 data. Gen 3 ring required."
      />
      <OuraBarChart
        title="Stress (High)"
        endpoint="stress"
        dataKey="stressHigh"
        format="minutes"
      />
      <OuraBarChart
        title="Workouts"
        endpoint="workout"
        dataKey="workoutCount"
        format="score"
      />
      <OuraBarChart
        title="Heart Rate (Avg BPM)"
        endpoint="heartrate"
        dataKey="avgBpm"
        format="bpm"
        emptyMessage="No heart rate data. Gen 3 ring required."
      />
      <OuraBarChart
        title="Optimal Bedtime"
        endpoint="sleep-time"
        dataKey="bedtimeValue"
        format="time"
        emptyMessage="Not enough sleep data for recommendations."
      />
      <HealthTrackerClient />
    </main>
  );
}
