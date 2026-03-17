/**
 * NutritionLookupService
 * Wraps a nutrition database API (e.g. USDA FDC, Nutritionix, Open Food Facts)
 * TODO: Plug in real API. Currently returns mocked data.
 */

export type NutritionInfo = {
  foodRefId: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize?: string; // e.g. "100g", "1 cup"
};

export interface NutritionLookupService {
  lookup(foodName: string, quantity: number, unit: string): Promise<NutritionInfo>;
}

/**
 * Stub implementation returning mocked nutrition per food.
 * Replace with real API (e.g. USDA FoodData Central, Nutritionix).
 */
export class StubNutritionLookupService implements NutritionLookupService {
  private mockDb: Record<string, NutritionInfo> = {
    "scrambled eggs": {
      foodRefId: "mock-eggs-1",
      kcal: 70,
      proteinG: 6,
      carbsG: 1,
      fatG: 5,
      servingSize: "1 egg",
    },
    "white toast": {
      foodRefId: "mock-toast-1",
      kcal: 80,
      proteinG: 2,
      carbsG: 15,
      fatG: 1,
      servingSize: "1 slice",
    },
    strawberries: {
      foodRefId: "mock-straw-1",
      kcal: 100,
      proteinG: 1,
      carbsG: 24,
      fatG: 0,
      servingSize: "½ cup",
    },
  };

  async lookup(
    foodName: string,
    quantity: number,
    unit: string
  ): Promise<NutritionInfo> {
    await new Promise((r) => setTimeout(r, 100));
    const key = foodName.toLowerCase().trim();
    const base = this.mockDb[key] ?? {
      foodRefId: null,
      kcal: 100,
      proteinG: 5,
      carbsG: 15,
      fatG: 5,
    };
    // Scale by quantity (base is per 1 serving; quantity from estimated portion)
    const q = Math.max(0.25, quantity);
    return {
      foodRefId: base.foodRefId,
      kcal: Math.round(base.kcal * q),
      proteinG: Math.round(base.proteinG * q * 10) / 10,
      carbsG: Math.round(base.carbsG * q * 10) / 10,
      fatG: Math.round(base.fatG * q * 10) / 10,
      servingSize: base.servingSize,
    };
  }
}

export const nutritionLookupService: NutritionLookupService =
  new StubNutritionLookupService();
