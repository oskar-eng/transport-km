import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — kardex de un repuesto (?partId=)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const partId = req.nextUrl.searchParams.get("partId");
  const movements = await prisma.stockMovement.findMany({
    where: partId ? { partId } : {},
    include: { part: { select: { code: true, name: true, unit: true } } },
    orderBy: { createdAt: "desc" },
    take: partId ? 200 : 100,
  });
  return NextResponse.json(movements.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
}

// POST — registrar ingreso o salida (actualiza stock y guarda saldo/kardex)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; name: string; role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  if (!body.partId || !body.type || !body.quantity) return NextResponse.json({ error: "Repuesto, tipo y cantidad son obligatorios" }, { status: 400 });

  const qty = Number(body.quantity);
  if (qty <= 0) return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.findUnique({ where: { id: body.partId } });
      if (!part) throw new Error("Repuesto no encontrado");

      const delta = body.type === "INGRESO" ? qty : -qty;
      const newStock = part.stock + delta;
      if (newStock < 0) throw new Error("Stock insuficiente para la salida");

      await tx.sparePart.update({
        where: { id: part.id },
        data: { stock: newStock, ...(body.type === "INGRESO" && body.cost ? { cost: Number(body.cost) } : {}) },
      });

      return tx.stockMovement.create({
        data: {
          partId: part.id, type: body.type, quantity: qty,
          reason: body.reason || null, reference: body.reference || null,
          cost: body.cost ? Number(body.cost) : null, balance: newStock,
          createdById: user.id, createdByName: user.name,
        },
        include: { part: { select: { code: true, name: true, unit: true } } },
      });
    });
    return NextResponse.json({ ...result, createdAt: result.createdAt.toISOString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al registrar movimiento" }, { status: 400 });
  }
}
