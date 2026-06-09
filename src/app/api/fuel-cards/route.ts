import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"];

// Registros de carga del mes en curso (para calcular consumo por tarjeta)
async function cargasDelMes() {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioProx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return prisma.fuelRecord.findMany({
    where: { date: { gte: inicioMes, lt: inicioProx } },
    select: { driverDni: true, unitId: true, totalCost: true },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  const [cards, mesRecords] = await Promise.all([
    prisma.fuelCard.findMany({
      include: { unit: { select: { plate: true, model: true } } },
      orderBy: { holderName: "asc" },
    }),
    cargasDelMes(),
  ]);

  // El conductor solo ve su propia tarjeta
  const visibles = ADMIN_ROLES.includes(user.role)
    ? cards
    : cards.filter(c => c.driverId === user.id);

  const data = visibles.map(c => {
    const consumido = mesRecords
      .filter(r => r.driverDni === c.holderDni || (c.unitId != null && r.unitId === c.unitId))
      .reduce((s, r) => s + (r.totalCost ?? 0), 0);
    const disponible = Math.max(0, c.monthlyLimit - consumido);
    return {
      id: c.id, cardNumber: c.cardNumber, provider: c.provider,
      holderName: c.holderName, holderDni: c.holderDni, driverId: c.driverId,
      unitId: c.unitId, unit: c.unit, monthlyLimit: c.monthlyLimit, active: c.active,
      consumido, disponible,
    };
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  if (!body.holderName || !body.holderDni || body.monthlyLimit == null) {
    return NextResponse.json({ error: "Conductor, DNI y saldo mensual son obligatorios" }, { status: 400 });
  }

  const card = await prisma.fuelCard.create({
    data: {
      cardNumber:   body.cardNumber || null,
      provider:     body.provider || "PETROTHOR",
      holderName:   body.holderName,
      holderDni:    String(body.holderDni),
      driverId:     body.driverId || null,
      unitId:       body.unitId || null,
      monthlyLimit: Number(body.monthlyLimit),
      active:       body.active !== false,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json({ ...card, consumido: 0, disponible: card.monthlyLimit }, { status: 201 });
}
