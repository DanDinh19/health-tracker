import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { foodRecognitionService } from "@/lib/diet/food-recognition";
import { nutritionLookupService } from "@/lib/diet/nutrition-lookup";

// TODO: Store image in S3/Vercel Blob. For now return placeholder URL.
function getPhotoUrl(_userId: string, _timestamp: string): string {
  return `https://placeholder.local/meal-${Date.now()}.jpg`;
}

function guessMealType(utcHour: number): "breakfast" | "lunch" | "dinner" | "snack" {
  if (utcHour >= 5 && utcHour < 11) return "breakfast";
  if (utcHour >= 11 && utcHour < 15) return "lunch";
  if (utcHour >= 15 && utcHour < 21) return "dinner";
  return "snack";
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Not signed in. Use session cookie or X-API-Key header." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const mealTypeParam = formData.get("meal_type") as string | null;
    const timestampParam = formData.get("timestamp") as string | null;

    const timestamp = timestampParam ? new Date(timestampParam) : new Date();
    const mealType =
      (mealTypeParam as "breakfast" | "lunch" | "dinner" | "snack") ??
      guessMealType(timestamp.getUTCHours());

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: "Missing image file in form-data" },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const recognized = await foodRecognitionService.recognizeFromImage(buffer);

    const items: Array<{
      id: string;
      name: string;
      confidence: number;
      estimated_portion: string;
      quantity: number;
      unit: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }> = [];

    let totalKcal = 0;
    let totalProteinG = 0;
    let totalCarbsG = 0;
    let totalFatG = 0;

    for (let i = 0; i < recognized.length; i++) {
      const r = recognized[i];
      const qty = parsePortionToQuantity(r.estimatedPortion);
      const unit = parsePortionToUnit(r.estimatedPortion);
      const nutrition = await nutritionLookupService.lookup(r.name, qty, unit);

      const id = `item-${i}-${Date.now()}`;
      items.push({
        id,
        name: r.name,
        confidence: r.confidence,
        estimated_portion: r.estimatedPortion,
        quantity: qty,
        unit,
        kcal: nutrition.kcal,
        protein_g: nutrition.proteinG,
        carbs_g: nutrition.carbsG,
        fat_g: nutrition.fatG,
      });

      totalKcal += nutrition.kcal;
      totalProteinG += nutrition.proteinG;
      totalCarbsG += nutrition.carbsG;
      totalFatG += nutrition.fatG;
    }

    const photoUrl = getPhotoUrl(userId, timestamp.toISOString());

    return NextResponse.json({
      photo_url: photoUrl,
      meal_type: mealType,
      timestamp: timestamp.toISOString(),
      items,
      total_kcal: Math.round(totalKcal),
      total_protein_g: Math.round(totalProteinG * 10) / 10,
      total_carbs_g: Math.round(totalCarbsG * 10) / 10,
      total_fat_g: Math.round(totalFatG * 10) / 10,
    });
  } catch (err) {
    console.error("Meal analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

function parsePortionToQuantity(portion: string): number {
  const m = portion.match(/^(\d+\.?\d*)\s/);
  if (m) return parseFloat(m[1]);
  const half = portion.toLowerCase().includes("½") || portion.includes("1/2");
  return half ? 0.5 : 1;
}

function parsePortionToUnit(portion: string): string {
  return "serving"; // Simplified; could parse "piece", "cup", "slice", etc.
}
