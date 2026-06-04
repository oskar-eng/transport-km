import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const status = searchParams.get("status"); // VIGENTE | POR_VENCER | VENCIDO

  const docs = await prisma.vehicleDocument.findMany({
    where: { ...(unitId ? { unitId } : {}) },
    include: { unit: { select: { plate: true, model: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const withStatus = docs.map((d) => ({
    ...d,
    docStatus: d.expiryDate < now ? "VENCIDO"
      : d.expiryDate < in30 ? "POR_VENCER"
      : "VIGENTE",
  }));

  const filtered = status ? withStatus.filter((d) => d.docStatus === status) : withStatus;
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const doc = await prisma.vehicleDocument.create({
    data: {
      unitId:     body.unitId,
      type:       body.type,
      name:       body.name,
      issueDate:  body.issueDate ? new Date(body.issueDate) : null,
      expiryDate: new Date(body.expiryDate),
      fileUrl:    body.fileUrl ?? null,
      notes:      body.notes ?? null,
    },
    include: { unit: { select: { plate: true, model: true } } },
  });
  return NextResponse.json(doc, { status: 201 });
}
