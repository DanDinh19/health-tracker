import { NextRequest, NextResponse } from "next/server";
import { zonedTimeToUtc } from "date-fns-tz";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// TODO: Fetch from user profile. Hardcoded for now.
const DEFAULT_TARGET_KCAL = 2000;
const DEFAULT_TARGET_PROTEIN_G = 150;
const DEFAULT_TARGET_CARBS_G = 250;
const DEFAULT_TARGET_FAT_G = 65;

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  try {
    const tzParam = request.nextUrl.searchParams.get("timezone");
    const dateParam = request.nextUrl.searchParams.get("date");
    const tz = tzParam || "UTC";
    const now = new Date();
    const todayStr =
      dateParam ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

    const [y, m, d] = todayStr.split("-").map(Number);
    const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
    const startOfDay = zonedTimeToUtc(startLocal, tz);
    const endOfDay = zonedTimeToUtc(endLocal, tz);

    const meals = await prisma.meal.findMany({
      where: {
        userId,
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
      orderBy: { timestamp: "asc" },
    });

    let totalKcal = 0;
    let totalProteinG = 0;
    let totalCarbsG = 0;
    let totalFatG = 0;

    const grouped: Record<
      string,
      Array<{
        id: string;
        timestamp: string;
        meal_type: string;
        photo_url: string | null;
        short_description: string;
        total_kcal: number;
      }>
    > = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };

    for (const m of meals) {
      totalKcal += m.totalKcal;
      totalProteinG += m.totalProteinG;
      totalCarbsG += m.totalCarbsG;
      totalFatG += m.totalFatG;

      const short = m.items
        .slice(0, 3)
        .map((i) => i.foodName)
        .join(", ");

      const list = grouped[m.mealType] ?? [];
      list.push({
        id: m.id,
        timestamp: m.timestamp.toISOString(),
        meal_type: m.mealType,
        photo_url: m.photoUrl,
        short_description: short || "Meal",
        total_kcal: m.totalKcal,
      });
      grouped[m.mealType] = list;
    }

    return NextResponse.json({
      date: todayStr,
      total_kcal: Math.round(totalKcal),
      total_protein_g: Math.round(totalProteinG * 10) / 10,
      total_carbs_g: Math.round(totalCarbsG * 10) / 10,
      total_fat_g: Math.round(totalFatG * 10) / 10,
      target_kcal: DEFAULT_TARGET_KCAL,
      target_protein_g: DEFAULT_TARGET_PROTEIN_G,
      target_carbs_g: DEFAULT_TARGET_CARBS_G,
      target_fat_g: DEFAULT_TARGET_FAT_G,
      meals: grouped,
    });
  } catch (err) {
    console.error("Diet today error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
