import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { id: string; role: string };
  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Admin/Jefe pueden borrar cualquiera; conductor solo los suyos
  const canDelete = ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role) || expense.createdById === user.id;
  if (!canDelete) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
