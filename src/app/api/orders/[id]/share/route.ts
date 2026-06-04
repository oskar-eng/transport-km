import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  // Check order exists
  const order = await prisma.serviceOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  // If already has token, return it; otherwise generate one
  let token = order.shareToken;
  if (!token) {
    token = randomBytes(16).toString("hex");
    await prisma.serviceOrder.update({
      where: { id },
      data: { shareToken: token },
    });
  }

  return NextResponse.json({ token });
}
