/**
 * GET /api/admin/reportes/excel?localId=&anio=&mes=
 * Descarga el reporte en Excel. Sin "mes" = reporte del año completo; con "mes" (1-12) = reporte mensual.
 */
import { z } from "zod";
import { manejador } from "@/lib/api";
import { generarReporteExcel, respuestaExcel } from "@/server/servicios/reportes-excel";

const consulta = z.object({
  localId: z.uuid("Selecciona un local."),
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export const GET = manejador("ADMIN", async ({ req }) => {
  const parametros = Object.fromEntries(req.nextUrl.searchParams);
  if (!parametros.mes) delete parametros.mes;
  const { localId, anio, mes } = consulta.parse(parametros);
  return respuestaExcel(await generarReporteExcel(localId, anio, mes));
});
