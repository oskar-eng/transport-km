// Se ejecuta una vez al arrancar el servidor (runtime Node.js).
// Programa la revisión diaria de vencimientos de documentos → notificación push.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const RUN_HOUR_UTC = 13; // 13:00 UTC = 8:00 a.m. hora Perú

  function msUntilNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(RUN_HOUR_UTC, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }

  async function run() {
    try {
      const { checkExpirations } = await import("@/lib/checkExpirations");
      const res = await checkExpirations();
      console.log("[cron] Revisión de vencimientos:", res);
    } catch (e) {
      console.error("[cron] Error en revisión de vencimientos:", e);
    }
  }

  function schedule() {
    setTimeout(async () => {
      await run();
      setInterval(run, 24 * 60 * 60 * 1000); // cada 24 horas
    }, msUntilNextRun());
  }

  schedule();
  console.log("[cron] Revisión diaria de vencimientos programada (08:00 hora Perú)");
}
