import { prisma } from "@/lib/prisma";

export type OuraDataType =
  | "sleep"
  | "activity"
  | "readiness"
  | "sleep_score"
  | "spo2"
  | "stress"
  | "workout"
  | "heartrate"
  | "sleep_time";

export async function saveOuraData(
  userId: string,
  type: OuraDataType,
  rows: Array<Record<string, unknown>>
) {
  if (rows.length === 0) return;

  await prisma.$transaction(
    rows.map((row) =>
      prisma.ouraData.upsert({
        where: {
          userId_type_day: {
            userId,
            type,
            day: String(row.day),
          },
        },
        create: {
          userId,
          type,
          day: String(row.day),
          data: row as object,
        },
        update: {
          data: row as object,
          syncedAt: new Date(),
        },
      })
    )
  );
}

export async function getOuraData(
  userId: string,
  type: OuraDataType,
  startDate: string,
  endDate: string
): Promise<Array<Record<string, unknown>>> {
  const rows = await prisma.ouraData.findMany({
    where: {
      userId,
      type,
      day: { gte: startDate, lte: endDate },
    },
    orderBy: { day: "asc" },
  });
  return rows.map((r) => r.data as Record<string, unknown>);
}
