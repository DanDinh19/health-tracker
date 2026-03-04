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
      const cached = await getOuraData(userId, "spo2", startDate, endDate);
      if (cached.length > 0) return NextResponse.json({ data: cached });
      return NextResponse.json({ error: "Oura not connected" }, { status: 400 });
    }

    const json = await fetchOura<{
      data?: Array<{
        day: string;
        spo2_percentage?: { average?: number };
      }>;
    }>("daily_spo2", { start_date: startDate, end_date: endDate });

    const data = (json.data ?? []).map((d) => ({
      day: d.day,
      spo2: d.spo2_percentage?.average ?? 0,
    })).sort((a, b) => a.day.localeCompare(b.day));

    await saveOuraData(userId, "spo2", data);
    return NextResponse.json({ data });
  } catch (err) {
    const cached = await getOuraData(userId, "spo2", startDate, endDate);
    if (cached.length > 0) return NextResponse.json({ data: cached });
    console.error("Oura SpO2 error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch SpO2" },
      { status: 500 }
    );
  }
}
