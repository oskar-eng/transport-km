import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const tire = await prisma.tire.update({
    where: { id },
    data: {
      brand:           body.brand,
      size:            body.size,
      position:        body.position,
      installDate:     new Date(body.installDate),
      installOdometer: Number(body.installOdometer),
      currentOdometer: Number(body.currentOdometer),
      status:          body.status,
      notes:           body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(tire);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.tire.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
