import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const doc = await prisma.vehicleDocument.update({
    where: { id },
    data: {
      type:       body.type,
      name:       body.name,
      issueDate:  body.issueDate ? new Date(body.issueDate) : null,
      expiryDate: new Date(body.expiryDate),
      fileUrl:    body.fileUrl ?? null,
      notes:      body.notes ?? null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(doc);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.vehicleDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
