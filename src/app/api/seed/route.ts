import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const existing = await prisma.user.findFirst({ where: { email: "admin@transport.com" } });
    if (existing) return NextResponse.json({ message: "Ya existe el seed" });

    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        name: "Administrador",
        email: "admin@transport.com",
        password: hash,
        role: "ADMINISTRADOR",
      },
    });

    const conductorHash = await bcrypt.hash("conductor123", 10);
    await prisma.user.create({
      data: {
        name: "Juan Pérez",
        email: "conductor@transport.com",
        password: conductorHash,
        role: "CONDUCTOR",
      },
    });

    for (let i = 1; i <= 5; i++) {
      await prisma.unit.create({
        data: {
          plate: `ABC-${String(i).padStart(3, "0")}`,
          model: "Volvo FH",
          year: 2020 + (i % 4),
          status: "DISPONIBLE",
        },
      });
    }

    return NextResponse.json({ message: "Seed completado exitosamente" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
