import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const units = await prisma.unit.findMany({ orderBy: { plate: "asc" } });
  return NextResponse.json(units.map(u => ({
    ...u,
    acquisitionDate: u.acquisitionDate?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const unit = await prisma.unit.create({
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
      localType:       body.localType       || null,
      acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
      photoUrl:        body.photoUrl        || null,
      notes:           body.notes           || null,
    },
  });
  return NextResponse.json({
    ...unit,
    acquisitionDate: unit.acquisitionDate?.toISOString() ?? null,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  }, { status: 201 });
}
