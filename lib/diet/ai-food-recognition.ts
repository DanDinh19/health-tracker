/**
 * AI-powered food recognition using OpenAI GPT-4 Vision.
 * Identifies food in photos and estimates macros (calories, protein, carbs, fat)
 * and key micronutrients (fiber, sodium).
 *
 * Requires OPENAI_API_KEY in environment.
 */

import OpenAI from "openai";

export type AIFoodItem = {
  name: string;
  estimatedPortion: string;
  confidence: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sodium_mg?: number;
};

export type AIFoodRecognitionResult = {
  items: AIFoodItem[];
};

const SYSTEM_PROMPT = `You are a nutrition expert. Analyze food photos and identify what foods are visible, estimate portion sizes, and provide nutrition estimates.

For each food item, provide:
- name: clear food name (e.g. "grilled chicken breast", "mixed salad")
- estimatedPortion: human-readable portion (e.g. "1 cup", "2 eggs", "150g", "1 medium apple")
- confidence: 0-1 how confident you are in the identification
- kcal: estimated calories for that portion
- protein_g: grams of protein
- carbs_g: grams of carbohydrates
- fat_g: grams of fat
- fiber_g: (optional) grams of fiber
- sodium_mg: (optional) milligrams of sodium

Base estimates on typical serving sizes and USDA/nutrition database values. For prepared foods, estimate based on visible ingredients. If the image is unclear or contains no food, return an empty items array.`;

const USER_PROMPT = `Identify all foods visible in this image. For each food, estimate the portion size shown and provide nutrition (calories, protein, carbs, fat). Return valid JSON only, no markdown, in this exact format:

{
  "items": [
    {
      "name": "food name",
      "estimatedPortion": "1 cup",
      "confidence": 0.9,
      "kcal": 150,
      "protein_g": 10,
      "carbs_g": 15,
      "fat_g": 5,
      "fiber_g": 2,
      "sodium_mg": 200
    }
  ]
}`;

export async function analyzeFoodImageWithAI(
  imageBuffer: Buffer
): Promise<AIFoodItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your environment to use AI food recognition."
    );
  }

  const openai = new OpenAI({ apiKey });
  const base64 = imageBuffer.toString("base64");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: "high",
            },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content) as AIFoodRecognitionResult;
  if (!Array.isArray(parsed.items)) {
    return [];
  }

  return parsed.items.map((item) => ({
    name: String(item.name ?? "Unknown food"),
    estimatedPortion: String(item.estimatedPortion ?? "1 serving"),
    confidence: Math.min(1, Math.max(0, Number(item.confidence ?? 0.7))),
    kcal: Math.max(0, Number(item.kcal ?? 0)),
    protein_g: Math.max(0, Number(item.protein_g ?? 0)),
    carbs_g: Math.max(0, Number(item.carbs_g ?? 0)),
    fat_g: Math.max(0, Number(item.fat_g ?? 0)),
    fiber_g: item.fiber_g != null ? Number(item.fiber_g) : undefined,
    sodium_mg: item.sodium_mg != null ? Number(item.sodium_mg) : undefined,
  }));
}
