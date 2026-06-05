import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parts = await prisma.sparePart.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(parts.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  if (!body.code || !body.name) return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });

  try {
    const part = await prisma.sparePart.create({
      data: {
        code: String(body.code).toUpperCase(), name: body.name, category: body.category || null,
        brand: body.brand || null, unit: body.unit || "UND",
        stock: body.stock ? Number(body.stock) : 0, minStock: body.minStock ? Number(body.minStock) : 0,
        cost: body.cost ? Number(body.cost) : null, location: body.location || null, notes: body.notes || null,
      },
    });
    return NextResponse.json({ ...part, createdAt: part.createdAt.toISOString(), updatedAt: part.updatedAt.toISOString() }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe un repuesto con ese código" }, { status: 409 });
  }
}
