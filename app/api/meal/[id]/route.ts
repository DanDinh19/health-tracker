import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MealItemBody = {
  food_name: string;
  quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type MealUpdateBody = {
  timestamp?: string;
  meal_type?: string;
  items?: MealItemBody[];
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(_request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const meal = await prisma.meal.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: meal.id,
      timestamp: meal.timestamp.toISOString(),
      meal_type: meal.mealType,
      photo_url: meal.photoUrl,
      total_kcal: meal.totalKcal,
      total_protein_g: meal.totalProteinG,
      total_carbs_g: meal.totalCarbsG,
      total_fat_g: meal.totalFatG,
      items: meal.items.map((i) => ({
        id: i.id,
        food_name: i.foodName,
        quantity: i.quantity,
        unit: i.unit,
        kcal: i.kcal,
        protein_g: i.proteinG,
        carbs_g: i.carbsG,
        fat_g: i.fatG,
      })),
    });
  } catch (err) {
    console.error("Meal fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const meal = await prisma.meal.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    const body = (await request.json()) as MealUpdateBody;

    const updates: {
      timestamp?: Date;
      mealType?: string;
      totalKcal?: number;
      totalProteinG?: number;
      totalCarbsG?: number;
      totalFatG?: number;
    } = {};

    if (body.timestamp) updates.timestamp = new Date(body.timestamp);
    if (body.meal_type) updates.mealType = body.meal_type;

    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const totalKcal = body.items.reduce((s, i) => s + (i.kcal ?? 0), 0);
      const totalProteinG = body.items.reduce(
        (s, i) => s + (i.protein_g ?? 0),
        0
      );
      const totalCarbsG = body.items.reduce(
        (s, i) => s + (i.carbs_g ?? 0),
        0
      );
      const totalFatG = body.items.reduce((s, i) => s + (i.fat_g ?? 0), 0);
      updates.totalKcal = totalKcal;
      updates.totalProteinG = totalProteinG;
      updates.totalCarbsG = totalCarbsG;
      updates.totalFatG = totalFatG;

      await prisma.mealItem.deleteMany({ where: { mealId: id } });
      for (const item of body.items) {
        await prisma.mealItem.create({
          data: {
            mealId: id,
            foodName: item.food_name,
            quantity: item.quantity ?? 1,
            unit: item.unit ?? "serving",
            kcal: item.kcal ?? 0,
            proteinG: item.protein_g ?? 0,
            carbsG: item.carbs_g ?? 0,
            fatG: item.fat_g ?? 0,
          },
        });
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.meal.update({
        where: { id },
        data: updates,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meal update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(_request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const meal = await prisma.meal.findFirst({
      where: { id, userId },
    });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    await prisma.meal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meal delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
