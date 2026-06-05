import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — lista de plantillas. Filtro opcional ?brand=&type= (para cargar materiales en una OT)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const brand = req.nextUrl.searchParams.get("brand");
  const type = req.nextUrl.searchParams.get("type");
  const where: Record<string, unknown> = {};
  if (brand) where.brand = { equals: brand, mode: "insensitive" };
  if (type) where.type = type;

  const templates = await prisma.maintenanceTemplate.findMany({ where, include: { items: true }, orderBy: [{ brand: "asc" }, { type: "asc" }] });
  return NextResponse.json(templates.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  if (!body.brand || !body.type || !body.name) return NextResponse.json({ error: "Marca, tipo y nombre son obligatorios" }, { status: 400 });

  const tpl = await prisma.maintenanceTemplate.create({
    data: {
      brand: body.brand, type: body.type, name: body.name, notes: body.notes || null,
      items: { create: (body.items ?? []).filter((i: { partName?: string }) => i.partName).map((i: { partId?: string; partName: string; quantity?: number }) => ({ partId: i.partId || null, partName: i.partName, quantity: i.quantity ? Number(i.quantity) : 1 })) },
    },
    include: { items: true },
  });
  return NextResponse.json({ ...tpl, createdAt: tpl.createdAt.toISOString(), updatedAt: tpl.updatedAt.toISOString() }, { status: 201 });
}
