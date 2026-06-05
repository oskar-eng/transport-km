import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const unit = await prisma.unit.update({
    where: { id },
    data: {
      plate:           body.plate,
      brand:           body.brand           || null,
      model:           body.model,
      year:            Number(body.year),
      vin:             body.vin             || null,
      vehicleType:     body.vehicleType     || null,
      axles:           body.axles           ? Number(body.axles) : null,
      loadCapacity:    body.loadCapacity    ? Number(body.loadCapacity) : null,
      fuelCapacity:    body.fuelCapacity    ? Number(body.fuelCapacity) : null,
      ownerCompany:    body.ownerCompany    || null,
      localType:       body.localType       !== undefined ? (body.localType || null) : undefined,
      acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
      photoUrl:        body.photoUrl        !== undefined ? body.photoUrl : undefined,
      notes:           body.notes           || null,
      ...(body.status ? { status: body.status } : {}),
    },
  });
  return NextResponse.json({
    ...unit,
    acquisitionDate: unit.acquisitionDate?.toISOString() ?? null,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (user.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.unit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
