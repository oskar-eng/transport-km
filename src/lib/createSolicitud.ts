import { prisma } from "@/lib/prisma";

// Crea una "solicitud" (registro histórico) cada vez que se sube/actualiza un documento.
export async function createSolicitud(params: {
  entidad: "CHOFER" | "CAMION" | "CARRETA";
  docOrPlate: string;
  entityName?: string | null;
  localType?: string | null;
  docType: string;       // descripción del documento (ej: "Licencia de Conducir")
  fileUrl?: string | null;
  expiryDate?: string | Date | null;
  userId?: string | null;
  userName?: string | null;
}) {
  try {
    const count = await prisma.solicitud.count();
    await prisma.solicitud.create({
      data: {
        numero:        13000 + count + 1,
        tipo:          "MODIFICACION",
        entidad:       params.entidad,
        docOrPlate:    params.docOrPlate,
        entityName:    params.entityName ?? null,
        localType:     params.localType ?? null,
        docType:       params.docType,
        fileUrl:       params.fileUrl ?? null,
        expiryDate:    params.expiryDate ? new Date(params.expiryDate) : null,
        estado:        "APROBADA",
        createdById:   params.userId ?? null,
        createdByName: params.userName ?? null,
      },
    });
  } catch (e) {
    console.error("createSolicitud error:", e);
  }
}
