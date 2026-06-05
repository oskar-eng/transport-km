import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { DRIVER_DOC_TYPES } from "@/lib/driverDocs";
import { UNIT_DOC_TYPES, NO_EXPIRY_TYPES } from "@/lib/vehicleDocsFixed";

const DRIVER_LABELS = Object.fromEntries(DRIVER_DOC_TYPES.map(t => [t.key, t.label]));
const UNIT_LABELS = Object.fromEntries(UNIT_DOC_TYPES.map(t => [t.key, t.label]));

const DAYS_AHEAD = 15; // avisar 15 días antes

function vapidReady() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@transport.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  return true;
}

function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export async function checkExpirations() {
  const limit = new Date(Date.now() + DAYS_AHEAD * 86400000);

  // Documentos de conductores que vencen pronto o ya vencidos
  const driverDocs = await prisma.driverDocument.findMany({
    where: { expiryDate: { not: null, lte: limit } },
    include: { driver: { select: { firstName: true, lastName: true } } },
  });

  // Documentos de unidades (excluir los sin vencimiento como FOTO_PLACA)
  const unitDocs = await prisma.unitDocument.findMany({
    where: { type: { notIn: NO_EXPIRY_TYPES }, expiryDate: { not: null, lte: limit } },
    include: { unit: { select: { plate: true } } },
  });

  const alerts: { texto: string; dias: number }[] = [];

  for (const d of driverDocs) {
    const dias = daysUntil(d.expiryDate!);
    const quien = `${d.driver.firstName} ${d.driver.lastName}`;
    const doc = DRIVER_LABELS[d.type] ?? d.type;
    alerts.push({ texto: `${quien}: ${doc} ${dias < 0 ? `vencido hace ${Math.abs(dias)}d` : `vence en ${dias}d`}`, dias });
  }
  for (const d of unitDocs) {
    const dias = daysUntil(d.expiryDate!);
    const doc = UNIT_LABELS[d.type] ?? d.type;
    alerts.push({ texto: `${d.unit.plate}: ${doc} ${dias < 0 ? `vencido hace ${Math.abs(dias)}d` : `vence en ${dias}d`}`, dias });
  }

  if (alerts.length === 0) return { alerts: 0, sent: 0 };

  alerts.sort((a, b) => a.dias - b.dias);

  if (!vapidReady()) return { alerts: alerts.length, sent: 0, note: "VAPID no configurado" };

  // Destinatarios: administradores y jefes con notificaciones activas
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMINISTRADOR", "JEFE_TRANSPORTE", "SUPERVISOR"] } },
    include: { pushSubscriptions: true },
  });

  const title = `⚠️ ${alerts.length} documento${alerts.length > 1 ? "s" : ""} por vencer`;
  const body = alerts.slice(0, 4).map(a => a.texto).join("\n") + (alerts.length > 4 ? `\n…y ${alerts.length - 4} más` : "");

  let sent = 0;
  for (const admin of admins) {
    for (const sub of admin.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: "/dashboard" }),
        );
        sent++;
      } catch {
        // suscripción inválida — ignorar
      }
    }
  }

  return { alerts: alerts.length, sent };
}
