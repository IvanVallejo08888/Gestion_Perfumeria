/** GET /api/admin/limpieza/resumen?localId= — Lo que el local tiene hoy (antes de limpiar). Solo administrador. */
import { z } from "zod";
import { manejador, ok } from "@/lib/api";
import { resumenLocal } from "@/server/servicios/limpieza";

const consulta = z.object({ localId: z.uuid("Elige un local.") });

export const GET = manejador("ADMIN", async ({ req }) => {
  const { localId } = consulta.parse({ localId: req.nextUrl.searchParams.get("localId") });
  return ok(await resumenLocal(localId));
});
