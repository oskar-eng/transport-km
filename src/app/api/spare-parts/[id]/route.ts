import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const part = await prisma.sparePart.update({
    where: { id },
    data: {
      name: body.name, category: body.category || null, brand: body.brand || null, unit: body.unit || "UND",
      minStock: body.minStock != null ? Number(body.minStock) : undefined,
      cost: body.cost != null && body.cost !== "" ? Number(body.cost) : undefined,
      location: body.location || null, notes: body.notes || null,
    },
  });
  return NextResponse.json({ ...part, createdAt: part.createdAt.toISOString(), updatedAt: part.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.sparePart.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
