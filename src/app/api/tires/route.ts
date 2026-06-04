import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const tires = await prisma.tire.findMany({
    where: unitId ? { unitId } : {},
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: [{ unitId: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(tires);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const tire = await prisma.tire.create({
    data: {
      unitId:          body.unitId,
      brand:           body.brand,
      size:            body.size,
      position:        body.position,
      installDate:     new Date(body.installDate),
      installOdometer: Number(body.installOdometer),
      currentOdometer: Number(body.currentOdometer),
      status:          body.status ?? "ACTIVO",
      notes:           body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(tire, { status: 201 });
}
