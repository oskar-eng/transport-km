import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — reemplaza datos + items de la plantilla
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  const tpl = await prisma.$transaction(async (tx) => {
    await tx.maintenanceTemplate.update({ where: { id }, data: { brand: body.brand, type: body.type, name: body.name, notes: body.notes || null } });
    if (Array.isArray(body.items)) {
      await tx.templateItem.deleteMany({ where: { templateId: id } });
      await tx.templateItem.createMany({ data: body.items.filter((i: { partName?: string }) => i.partName).map((i: { partId?: string; partName: string; quantity?: number }) => ({ templateId: id, partId: i.partId || null, partName: i.partName, quantity: i.quantity ? Number(i.quantity) : 1 })) });
    }
    return tx.maintenanceTemplate.findUnique({ where: { id }, include: { items: true } });
  });
  return NextResponse.json({ ...tpl, createdAt: tpl!.createdAt.toISOString(), updatedAt: tpl!.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  await prisma.maintenanceTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
