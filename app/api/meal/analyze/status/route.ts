import { NextResponse } from "next/server";

/**
 * Debug endpoint: returns whether OpenAI is configured.
 * Hit this from a browser to verify your Vercel deployment has OPENAI_API_KEY.
 */
export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  return NextResponse.json({
    openai_configured: hasKey,
    message: hasKey
      ? "AI food recognition is enabled"
      : "OPENAI_API_KEY not set - add it in Vercel Settings → Environment Variables",
  });
}
