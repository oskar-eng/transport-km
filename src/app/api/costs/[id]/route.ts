import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const cost = await prisma.otherCost.update({
    where: { id },
    data: {
      category:    body.category,
      description: body.description,
      amount:      Number(body.amount),
      date:        new Date(body.date),
      notes:       body.notes || null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(cost);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.otherCost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
