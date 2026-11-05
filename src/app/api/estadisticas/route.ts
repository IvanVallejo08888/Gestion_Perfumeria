/** GET /api/estadisticas?anio= — Reportes y estadísticas del local del vendedor. */
import { z } from "zod";
import { comoVendedor, manejador, ok } from "@/lib/api";
import { obtenerEstadisticas } from "@/server/servicios/estadisticas";

const anioSchema = z.coerce.number().int().min(2000).max(2100);

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const anio = anioSchema.parse(req.nextUrl.searchParams.get("anio") ?? new Date().getFullYear());
  return ok(await obtenerEstadisticas(localId, anio));
});
