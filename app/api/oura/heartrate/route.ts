import { NextRequest, NextResponse } from "next/server";
import { fetchOura, getCurrentUserId, getOuraAccessToken } from "@/lib/oura";
import { getOuraData, saveOuraData } from "@/lib/oura-cache";

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
      const cached = await getOuraData(userId, "heartrate", startDate, endDate);
      if (cached.length > 0) return NextResponse.json({ data: cached });
      return NextResponse.json({ error: "Oura not connected" }, { status: 400 });
    }

    const startDatetime = start.toISOString().slice(0, 19) + "Z";
    const endDatetime = end.toISOString().slice(0, 19) + "Z";

    const json = await fetchOura<{
      data?: Array<{ bpm?: number; timestamp?: string; source?: string }>;
    }>("heartrate", {
      start_datetime: startDatetime,
      end_datetime: endDatetime,
    });

    const byDay = new Map<string, { sum: number; count: number }>();
    for (const h of json.data ?? []) {
      if (h.bpm == null) continue;
      const day = h.timestamp?.slice(0, 10) ?? "";
      if (!day) continue;
      if (!byDay.has(day)) byDay.set(day, { sum: 0, count: 0 });
      const entry = byDay.get(day)!;
      entry.sum += h.bpm;
      entry.count += 1;
    }

    const data = Array.from(byDay.entries())
      .map(([day, v]) => ({
        day,
        avgBpm: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    await saveOuraData(userId, "heartrate", data);
    return NextResponse.json({ data });
  } catch (err) {
    const cached = await getOuraData(userId, "heartrate", startDate, endDate);
    if (cached.length > 0) return NextResponse.json({ data: cached });
    console.error("Oura heart rate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch heart rate" },
      { status: 500 }
    );
  }
}
