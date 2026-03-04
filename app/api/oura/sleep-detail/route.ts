import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getOuraAccessToken } from "@/lib/oura";
import { fetchOura } from "@/lib/oura";

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

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day");
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Invalid day parameter (use YYYY-MM-DD)" }, { status: 400 });
  }

  const [y, m, d] = day.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 1);
  const startDate =
    prev.getFullYear() +
    "-" +
    String(prev.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(prev.getDate()).padStart(2, "0");

  try {
    const auth = await getOuraAccessToken();
    if (!auth) {
      return NextResponse.json(
        { error: "Oura not connected. Connect your Oura ring first." },
        { status: 400 }
      );
    }

    const json = await fetchOura<{ data?: SleepDoc[] }>("sleep", {
      start_date: startDate,
      end_date: day,
    });

    const raw = json.data ?? [];
    let data = raw.filter(
      (s) => s.day === day || s.day === startDate
    );
    if (data.length === 0 && raw.length > 0) {
      data = raw;
    }
    return NextResponse.json({ data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch sleep detail from Oura";
    console.error("Oura sleep detail API error:", err);
    return NextResponse.json(
      { error: String(message) },
      { status: 500 }
    );
  }
}
