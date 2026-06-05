import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const wos = await prisma.workOrder.findMany({
    include: { unit: { select: { plate: true, model: true, brand: true } }, materials: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(wos.map(w => ({ ...w, openedAt: w.openedAt.toISOString(), closedAt: w.closedAt?.toISOString() ?? null, createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString() })));
}

// POST — crea OT y DESCUENTA del stock los materiales vinculados a repuestos
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; name: string; role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  if (!body.unitId || !body.type) return NextResponse.json({ error: "Unidad y tipo son obligatorios" }, { status: 400 });
  const materials: { partId?: string; partName: string; quantity: number; unitCost?: number }[] = body.materials ?? [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.workOrder.count();
      const numero = 3000 + count + 1;

      const wo = await tx.workOrder.create({
        data: {
          numero, unitId: body.unitId, type: body.type, maintType: body.maintType || null, templateId: body.templateId || null,
          status: body.status || "ABIERTA", description: body.description || null, diagnosis: body.diagnosis || null,
          mechanic: body.mechanic || null, laborCost: body.laborCost ? Number(body.laborCost) : null,
          odometer: body.odometer ? Number(body.odometer) : null, evidenceUrl: body.evidenceUrl || null, testsDone: body.testsDone || null,
          materials: { create: materials.filter(m => m.partName).map(m => ({ partId: m.partId || null, partName: m.partName, quantity: Number(m.quantity) || 1, unitCost: m.unitCost ? Number(m.unitCost) : null })) },
        },
        include: { unit: { select: { plate: true, model: true, brand: true } }, materials: true },
      });

      // Descontar del almacén los materiales que son repuestos del catálogo
      for (const m of materials) {
        if (!m.partId) continue;
        const qty = Number(m.quantity) || 0;
        if (qty <= 0) continue;
        const part = await tx.sparePart.findUnique({ where: { id: m.partId } });
        if (!part) continue;
        const newStock = Math.max(0, part.stock - qty);
        await tx.sparePart.update({ where: { id: part.id }, data: { stock: newStock } });
        await tx.stockMovement.create({ data: { partId: part.id, type: "SALIDA", quantity: qty, reason: "Orden de trabajo", reference: `OT-${numero}`, balance: newStock, createdById: user.id, createdByName: user.name } });
      }

      return wo;
    });
    return NextResponse.json({ ...result, openedAt: result.openedAt.toISOString(), closedAt: result.closedAt?.toISOString() ?? null, createdAt: result.createdAt.toISOString(), updatedAt: result.updatedAt.toISOString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear OT" }, { status: 400 });
  }
}
