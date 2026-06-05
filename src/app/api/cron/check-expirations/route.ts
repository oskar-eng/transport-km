import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkExpirations } from "@/lib/checkExpirations";

export const dynamic = "force-dynamic";

// GET — revisa documentos por vencer y envía notificaciones push.
// Acceso: con ?secret=CRON_SECRET (para cron externo) o sesión de admin (para probar manual).
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && secret === cronSecret) {
    authorized = true;
  } else {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (role && ["ADMINISTRADOR", "JEFE_TRANSPORTE"].includes(role)) authorized = true;
  }

  if (!authorized) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await checkExpirations();
  return NextResponse.json({ ok: true, ...result });
}
