import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { appleHealthApiKey: true },
  });

  return NextResponse.json({
    apiKey: dbUser?.appleHealthApiKey ?? null,
  });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const apiKey = randomBytes(32).toString("hex");

  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      appleHealthApiKey: apiKey,
    },
    update: { appleHealthApiKey: apiKey },
  });

  return NextResponse.json({ apiKey });
}
