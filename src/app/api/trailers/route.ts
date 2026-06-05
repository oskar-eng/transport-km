import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const trailers = await prisma.trailer.findMany({
    orderBy: { plate: "asc" },
    include: { documents: true },
  });
  return NextResponse.json(trailers.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    documents: t.documents.map(d => ({ type: d.type, expiryDate: d.expiryDate?.toISOString() ?? null, fileUrl: d.fileUrl })),
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
  if (!body.plate || !body.year) return NextResponse.json({ error: "Placa y año son obligatorios" }, { status: 400 });

  const trailer = await prisma.trailer.create({
    data: {
      plate:         String(body.plate).toUpperCase(),
      length:        body.length ? Number(body.length) : null,
      equipmentType: body.equipmentType || null,
      year:          Number(body.year),
      axles:         body.axles ? Number(body.axles) : null,
      tare:          body.tare ? Number(body.tare) : null,
      localType:     body.localType || null,
      photoUrl:      body.photoUrl || null,
      notes:         body.notes || null,
    },
  });
  return NextResponse.json({ ...trailer, createdAt: trailer.createdAt.toISOString(), updatedAt: trailer.updatedAt.toISOString() }, { status: 201 });
}
