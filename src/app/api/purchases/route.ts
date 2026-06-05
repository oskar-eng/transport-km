import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const purchases = await prisma.purchaseOrder.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(purchases.map(p => ({ ...p, date: p.date.toISOString(), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; name: string; role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await req.json();
  if (!body.supplier || !body.date) return NextResponse.json({ error: "Proveedor y fecha son obligatorios" }, { status: 400 });
  const items: { partName: string; quantity: number; unitCost?: number }[] = body.items ?? [];
  const total = items.reduce((s, i) => s + (i.unitCost ?? 0) * (Number(i.quantity) || 0), 0);
  const count = await prisma.purchaseOrder.count();

  const po = await prisma.purchaseOrder.create({
    data: {
      numero: 7000 + count + 1, supplier: body.supplier, status: body.status || "SOLICITUD", date: new Date(body.date),
      description: body.description || null, total: total || null, receiptUrl: body.receiptUrl || null, notes: body.notes || null,
      createdById: user.id, createdByName: user.name,
      items: { create: items.filter(i => i.partName).map(i => ({ partName: i.partName, quantity: Number(i.quantity) || 1, unitCost: i.unitCost ? Number(i.unitCost) : null })) },
    },
    include: { items: true },
  });
  return NextResponse.json({ ...po, date: po.date.toISOString(), createdAt: po.createdAt.toISOString(), updatedAt: po.updatedAt.toISOString() }, { status: 201 });
}
