import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — all conductors with their profile and active unit
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const conductors = await prisma.user.findMany({
    where: { role: "CONDUCTOR" },
    include: {
      driverProfile: true,
      orders: {
        where: { status: "ACTIVO" },
        include: { unit: { select: { id: true, plate: true, model: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(conductors.map(c => ({
    id:      c.id,
    name:    c.name,
    email:   c.email,
    active:  c.active,
    profile: c.driverProfile ? {
      ...c.driverProfile,
      licenseExpiry: c.driverProfile.licenseExpiry.toISOString(),
      joinDate:      c.driverProfile.joinDate?.toISOString() ?? null,
      createdAt:     c.driverProfile.createdAt.toISOString(),
      updatedAt:     c.driverProfile.updatedAt.toISOString(),
    } : null,
    activeUnit: c.orders[0]?.unit ?? null,
  })));
}

// POST — create/update driver profile
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();

  const profile = await prisma.driverProfile.upsert({
    where:  { userId: body.userId },
    create: {
      userId:          body.userId,
      dni:             body.dni,
      firstName:       body.firstName,
      lastName:        body.lastName,
      licenseNumber:   body.licenseNumber,
      licenseCategory: body.licenseCategory,
      licenseExpiry:   new Date(body.licenseExpiry),
      phone:           body.phone  || null,
      joinDate:        body.joinDate ? new Date(body.joinDate) : null,
      status:          body.status ?? "ACTIVO",
      driverType:      body.driverType || null,
      photoUrl:        body.photoUrl || null,
    },
    update: {
      dni:             body.dni,
      firstName:       body.firstName,
      lastName:        body.lastName,
      licenseNumber:   body.licenseNumber,
      licenseCategory: body.licenseCategory,
      licenseExpiry:   new Date(body.licenseExpiry),
      phone:           body.phone  || null,
      joinDate:        body.joinDate ? new Date(body.joinDate) : null,
      status:          body.status ?? "ACTIVO",
      driverType:      body.driverType || null,
      photoUrl:        body.photoUrl || null,
    },
  });

  return NextResponse.json({
    ...profile,
    licenseExpiry: profile.licenseExpiry.toISOString(),
    joinDate:      profile.joinDate?.toISOString() ?? null,
    createdAt:     profile.createdAt.toISOString(),
    updatedAt:     profile.updatedAt.toISOString(),
  });
}
