import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getOuraAccessToken } from "@/lib/oura";
import { getOuraData, saveOuraData } from "@/lib/oura-cache";
import { fetchOura } from "@/lib/oura";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14", 10) || 14, 90);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const auth = await getOuraAccessToken();
    if (!auth) {
      try {
        const cached = await getOuraData(userId, "sleep", startDate, endDate);
        if (cached.length > 0) return NextResponse.json({ data: cached });
      } catch {
        // Cache table may not exist yet
      }
      return NextResponse.json(
        { error: "Oura not connected. Connect your Oura ring first." },
        { status: 400 }
      );
    }

    const json = await fetchOura<{
      data?: Array<{
        id: string;
        day: string;
        total_sleep_duration?: number;
        deep_sleep_duration?: number;
        rem_sleep_duration?: number;
        light_sleep_duration?: number;
        efficiency?: number;
        latency?: number;
      }>;
    }>("sleep", { start_date: startDate, end_date: endDate });

    const data = json.data ?? [];
    const byDay = new Map<string, { total: number; deep: number; rem: number; light: number }>();

    for (const s of data) {
      const day = s.day;
      const total = (s.total_sleep_duration ?? 0) / 3600;
      const deep = (s.deep_sleep_duration ?? 0) / 3600;
      const rem = (s.rem_sleep_duration ?? 0) / 3600;
      const light = (s.light_sleep_duration ?? 0) / 3600;

      if (byDay.has(day)) {
        const existing = byDay.get(day)!;
        existing.total += total;
        existing.deep += deep;
        existing.rem += rem;
        existing.light += light;
      } else {
        byDay.set(day, { total, deep, rem, light });
      }
    }

    const chartData = Array.from(byDay.entries())
      .map(([day, v]) => ({
        day,
        date: day,
        totalHours: Math.round(v.total * 10) / 10,
        deepHours: Math.round(v.deep * 10) / 10,
        remHours: Math.round(v.rem * 10) / 10,
        lightHours: Math.round(v.light * 10) / 10,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    try {
      await saveOuraData(userId, "sleep", chartData);
    } catch {
      // Cache save failed (table may not exist)
    }
    return NextResponse.json({ data: chartData });
  } catch (err) {
    try {
      const cached = await getOuraData(userId, "sleep", startDate, endDate);
      if (cached.length > 0) return NextResponse.json({ data: cached });
    } catch {
      // Cache read failed
    }
    const message = err instanceof Error ? err.message : "Failed to fetch sleep data from Oura";
    console.error("Oura sleep API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
