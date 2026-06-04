import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — update driver profile by userId
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as { role: string };
  if (!["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await req.json();

  const profile = await prisma.driverProfile.upsert({
    where:  { userId },
    create: {
      userId,
      dni:             body.dni,
      firstName:       body.firstName,
      lastName:        body.lastName,
      licenseNumber:   body.licenseNumber,
      licenseCategory: body.licenseCategory,
      licenseExpiry:   new Date(body.licenseExpiry),
      phone:           body.phone  || null,
      joinDate:        body.joinDate ? new Date(body.joinDate) : null,
      status:          body.status ?? "ACTIVO",
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
      photoUrl:        body.photoUrl !== undefined ? body.photoUrl : undefined,
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
