import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const solicitudes = await prisma.solicitud.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json(solicitudes.map(s => ({
    ...s,
    expiryDate: s.expiryDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
}
