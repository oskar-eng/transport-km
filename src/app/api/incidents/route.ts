import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; role: string };
  const where = user.role === "CONDUCTOR" ? { driverId: user.id } : {};
  const incidents = await prisma.incident.findMany({
    where, include: { unit: { select: { plate: true, model: true } } }, orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(incidents.map(i => ({ ...i, date: i.date.toISOString(), createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; name: string };
  const body = await req.json();
  if (!body.description || !body.date) return NextResponse.json({ error: "Descripción y fecha son obligatorias" }, { status: 400 });

  const count = await prisma.incident.count();
  const inc = await prisma.incident.create({
    data: {
      numero: 1000 + count + 1, unitId: body.unitId || null,
      driverId: body.driverId || user.id, driverName: body.driverName || user.name,
      date: new Date(body.date), description: body.description,
      severity: body.severity || "MEDIA", status: "ABIERTA", photoUrl: body.photoUrl || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json({ ...inc, date: inc.date.toISOString(), createdAt: inc.createdAt.toISOString(), updatedAt: inc.updatedAt.toISOString() }, { status: 201 });
}
