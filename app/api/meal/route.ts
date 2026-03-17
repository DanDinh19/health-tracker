import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MealItemBody = {
  food_name: string;
  food_ref_id?: string | null;
  quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type MealBody = {
  timestamp: string;
  meal_type: string;
  photo_url?: string | null;
  items: MealItemBody[];
  notes?: string | null;
};

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as MealBody;
    const { timestamp, meal_type, photo_url, items, notes } = body;

    if (!timestamp || !meal_type || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing timestamp, meal_type, or items" },
        { status: 400 }
      );
    }

    const totalKcal = items.reduce((s, i) => s + (i.kcal ?? 0), 0);
    const totalProteinG = items.reduce((s, i) => s + (i.protein_g ?? 0), 0);
    const totalCarbsG = items.reduce((s, i) => s + (i.carbs_g ?? 0), 0);
    const totalFatG = items.reduce((s, i) => s + (i.fat_g ?? 0), 0);

    const meal = await prisma.meal.create({
      data: {
        userId,
        timestamp: new Date(timestamp),
        mealType: meal_type,
        photoUrl: photo_url ?? null,
        totalKcal,
        totalProteinG: totalProteinG,
        totalCarbsG: totalCarbsG,
        totalFatG: totalFatG,
        source: "photo",
        notes: notes ?? null,
      },
    });

    for (const item of items) {
      await prisma.mealItem.create({
        data: {
          mealId: meal.id,
          foodName: item.food_name,
          foodRefId: item.food_ref_id ?? null,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? "serving",
          kcal: item.kcal ?? 0,
          proteinG: item.protein_g ?? 0,
          carbsG: item.carbs_g ?? 0,
          fatG: item.fat_g ?? 0,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      meal_id: meal.id,
    });
  } catch (err) {
    console.error("Meal save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
