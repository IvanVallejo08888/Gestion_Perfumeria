/**
 * GET /api/admin/reportes/consolidado?anio=&mes=
 * Excel con todos los locales comparados y la cartera de todos los locales.
 * Sin "mes" = año completo; con "mes" (1-12) = solo ese mes.
 */
import { z } from "zod";
import { manejador } from "@/lib/api";
import { generarReporteConsolidado, respuestaExcel } from "@/server/servicios/reportes-excel";

const consulta = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export const GET = manejador("ADMIN", async ({ req }) => {
  const parametros = Object.fromEntries(req.nextUrl.searchParams);
  if (!parametros.mes) delete parametros.mes;
  const { anio, mes } = consulta.parse(parametros);
  return respuestaExcel(await generarReporteConsolidado(anio, mes));
});
