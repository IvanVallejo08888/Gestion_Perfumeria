/**
 * GET /api/admin/limpieza/respaldo?localId=&alcance=&anio=&meses=3,4 — Copia de respaldo en Excel con
 * EXACTAMENTE lo que borraría la limpieza (una hoja por tabla). No modifica nada.
 * La respuesta trae el encabezado "X-Huella-Respaldo", que la ejecución exige. Solo administrador.
 */
import { manejador } from "@/lib/api";
import { parametros, solicitudLimpiezaSchema } from "@/lib/validaciones";
import { generarRespaldo } from "@/server/servicios/limpieza";
import { respuestaExcel } from "@/server/servicios/reportes-excel";

export const GET = manejador("ADMIN", async ({ req, usuario }) => {
  const solicitud = solicitudLimpiezaSchema.parse(parametros(req.nextUrl.searchParams));
  const { buffer, nombreArchivo, huella } = await generarRespaldo(solicitud, usuario);
  const respuesta = respuestaExcel({ buffer, nombreArchivo });
  respuesta.headers.set("X-Huella-Respaldo", huella);
  return respuesta;
});
