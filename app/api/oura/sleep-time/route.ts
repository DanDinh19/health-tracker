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
      const cached = await getOuraData(userId, "sleep_time", startDate, endDate);
      if (cached.length > 0) return NextResponse.json({ data: cached });
      return NextResponse.json({ error: "Oura not connected" }, { status: 400 });
    }

    const json = await fetchOura<{
      data?: Array<{
        day: string;
        optimal_bedtime?: { start_offset?: number; end_offset?: number };
        recommendation?: string;
        status?: string;
      }>;
    }>("sleep_time", { start_date: startDate, end_date: endDate });

    const data = (json.data ?? []).map((d) => {
      const startOffset = d.optimal_bedtime?.start_offset ?? 0;
      const endOffset = d.optimal_bedtime?.end_offset ?? 0;
      const midOffset = startOffset > 0 || endOffset > 0 ? (startOffset + endOffset) / 2 : 0;
      const bedtimeHour = Math.floor(midOffset / 60) % 24;
      const bedtimeMin = Math.round((midOffset % 60) / 15) * 15;
      return {
        day: d.day,
        bedtimeValue: midOffset > 0 ? bedtimeHour + bedtimeMin / 60 : 0,
        bedtimeLabel: midOffset > 0 ? `${bedtimeHour}:${bedtimeMin.toString().padStart(2, "0")}` : "",
        recommendation: d.recommendation ?? "",
        status: d.status ?? "",
      };
    }).sort((a, b) => a.day.localeCompare(b.day));

    await saveOuraData(userId, "sleep_time", data);
    return NextResponse.json({ data });
  } catch (err) {
    const cached = await getOuraData(userId, "sleep_time", startDate, endDate);
    if (cached.length > 0) return NextResponse.json({ data: cached });
    console.error("Oura sleep time error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sleep time" },
      { status: 500 }
    );
  }
}
