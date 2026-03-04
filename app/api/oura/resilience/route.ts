import { NextRequest, NextResponse } from "next/server";
import { fetchOura, getCurrentUserId, getOuraAccessToken } from "@/lib/oura";
import { getOuraData, saveOuraData } from "@/lib/oura-cache";

const LEVEL_SCORE: Record<string, number> = {
  limited: 1,
  adequate: 2,
  good: 3,
  great: 4,
};

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
        const cached = await getOuraData(userId, "resilience", startDate, endDate);
        if (cached.length > 0) return NextResponse.json({ data: cached });
      } catch {
        // Cache table may not exist
      }
      return NextResponse.json({ error: "Oura not connected" }, { status: 400 });
    }

    const json = await fetchOura<{
      data?: Array<{
        day: string;
        level?: string;
        contributors?: { sleep_recovery?: number; daytime_recovery?: number; stress?: number };
      }>;
    }>("daily_resilience", { start_date: startDate, end_date: endDate });

    const data = (json.data ?? []).map((d) => {
      const score = d.level ? (LEVEL_SCORE[d.level.toLowerCase()] ?? 0) : 0;
      const totalContrib = (d.contributors?.sleep_recovery ?? 0) +
        (d.contributors?.daytime_recovery ?? 0) +
        (d.contributors?.stress ?? 0);
      return {
        day: d.day,
        score: score > 0 ? score : (totalContrib > 0 ? totalContrib / 30 : 0),
        level: d.level ?? "",
      };
    }).sort((a, b) => a.day.localeCompare(b.day));

    try {
      await saveOuraData(userId, "resilience", data);
    } catch {
      // Cache save failed
    }
    return NextResponse.json({ data });
  } catch (err) {
    try {
      const cached = await getOuraData(userId, "resilience", startDate, endDate);
      if (cached.length > 0) return NextResponse.json({ data: cached });
    } catch {
      // Cache read failed
    }
    console.error("Oura resilience error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch resilience" },
      { status: 500 }
    );
  }
}
