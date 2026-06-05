import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  // Conductor: solo sus propios gastos. Otros: todos.
  const where = user.role === "CONDUCTOR" ? { createdById: user.id } : {};
  const expenses = await prisma.expense.findMany({
    where,
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses.map(e => ({
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; role: string; name: string };

  const body = await req.json();
  if (!body.unitId || !body.category || !body.description || body.amount == null || !body.date) {
    return NextResponse.json({ error: "Unidad, categoría, descripción, monto y fecha son obligatorios" }, { status: 400 });
  }

  // Conductor solo puede registrar gastos de su unidad asignada (orden activa)
  if (user.role === "CONDUCTOR") {
    const activeOrder = await prisma.serviceOrder.findFirst({
      where: { driverId: user.id, status: "ACTIVO" },
      select: { unitId: true },
    });
    if (!activeOrder || activeOrder.unitId !== body.unitId) {
      return NextResponse.json({ error: "Solo puedes registrar gastos de tu unidad asignada" }, { status: 403 });
    }
  }

  const expense = await prisma.expense.create({
    data: {
      unitId:        body.unitId,
      category:      body.category,
      description:   body.description,
      amount:        Number(body.amount),
      date:          new Date(body.date),
      receiptUrl:    body.receiptUrl || null,
      createdById:   user.id,
      createdByName: user.name,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });

  return NextResponse.json({
    ...expense,
    date: expense.date.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }, { status: 201 });
}
