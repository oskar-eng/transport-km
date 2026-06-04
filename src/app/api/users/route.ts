import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (user.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const u = session.user as { role: string };
  if (u.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const hash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, password: hash, role: body.role },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
