/** GET /api/admin/estadisticas?localId=&anio= — Estadísticas de cualquier local (vista del administrador). */
import { z } from "zod";
import { manejador, ok } from "@/lib/api";
import { obtenerEstadisticas } from "@/server/servicios/estadisticas";

const consulta = z.object({
  localId: z.uuid("Selecciona un local."),
  anio: z.coerce.number().int().min(2000).max(2100),
});

export const GET = manejador("ADMIN", async ({ req }) => {
  const { localId, anio } = consulta.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await obtenerEstadisticas(localId, anio));
});
