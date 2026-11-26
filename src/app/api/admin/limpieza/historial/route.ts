/** GET /api/admin/limpieza/historial?localId= — Historial de limpiezas (solo lectura; no se puede borrar). Solo administrador. */
import { z } from "zod";
import { manejador, ok } from "@/lib/api";
import { historialLimpiezas } from "@/server/servicios/limpieza";

const consulta = z.object({ localId: z.uuid("Local no válido.").optional() });

export const GET = manejador("ADMIN", async ({ req }) => {
  const { localId } = consulta.parse({ localId: req.nextUrl.searchParams.get("localId") || undefined });
  return ok({ limpiezas: await historialLimpiezas(localId) });
});
