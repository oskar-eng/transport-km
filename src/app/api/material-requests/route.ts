import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const reqs = await prisma.materialRequest.findMany({
    include: { unit: { select: { plate: true, model: true } } }, orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reqs.map(r => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; name: string };
  const body = await req.json();
  if (!body.material || !body.date) return NextResponse.json({ error: "Material y fecha son obligatorios" }, { status: 400 });

  const count = await prisma.materialRequest.count();
  const r = await prisma.materialRequest.create({
    data: {
      numero: 5000 + count + 1, unitId: body.unitId || null,
      requestedById: user.id, requestedByName: body.requestedByName || user.name,
      date: new Date(body.date), material: body.material, quantity: body.quantity ? Number(body.quantity) : 1,
      status: "PENDIENTE", photoUrl: body.photoUrl || null, notes: body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }, { status: 201 });
}
