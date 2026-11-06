/**
 * GET /api/reportes/excel?anio=&mes=
 * Descarga el reporte en Excel del local del vendedor (el local sale de la sesión, no de la URL).
 * Sin "mes" = año completo; con "mes" (1-12) = reporte mensual.
 */
import { z } from "zod";
import { comoVendedor, manejador } from "@/lib/api";
import { generarReporteExcel, respuestaExcel } from "@/server/servicios/reportes-excel";

const consulta = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const parametros = Object.fromEntries(req.nextUrl.searchParams);
  if (!parametros.mes) delete parametros.mes;
  const { anio, mes } = consulta.parse(parametros);
  return respuestaExcel(await generarReporteExcel(localId, anio, mes));
});
