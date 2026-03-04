import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { ouraAccessToken: true },
    });

    return NextResponse.json({
      connected: !!dbUser?.ouraAccessToken,
    });
  } catch (err) {
    console.error("Oura status error:", err);
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
