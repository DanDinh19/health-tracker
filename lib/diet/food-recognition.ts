/**
 * FoodRecognitionService
 * Wraps a third-party food recognition API (e.g. Google Vision, Clarifai, etc.)
 * TODO: Plug in real API. Currently returns mocked data.
 */

export type RecognizedFood = {
  name: string;
  confidence: number; // 0-1
  estimatedPortion: string; // e.g. "2 eggs", "1 slice", "½ cup"
};

export interface FoodRecognitionService {
  recognizeFromImage(imageBuffer: Buffer): Promise<RecognizedFood[]>;
}

/**
 * Stub implementation returning mocked food items.
 * Replace with real API client (e.g. Google Cloud Vision, Clarifai Food model).
 */
export class StubFoodRecognitionService implements FoodRecognitionService {
  async recognizeFromImage(_imageBuffer: Buffer): Promise<RecognizedFood[]> {
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800));
    return [
      { name: "scrambled eggs", confidence: 0.92, estimatedPortion: "2 eggs" },
      { name: "white toast", confidence: 0.88, estimatedPortion: "1 slice" },
      { name: "strawberries", confidence: 0.85, estimatedPortion: "½ cup" },
    ];
  }
}

export const foodRecognitionService: FoodRecognitionService =
  new StubFoodRecognitionService();
