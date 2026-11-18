/**
 * GET /api/dashboard?anio=&mes=&localId= — Dashboard de reportes.
 *  - Vendedor: SIEMPRE su local (sale de la sesión; un localId en la dirección se ignora).
 *  - Administrador: el local elegido; sin localId = consolidado de todos los locales.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { filtroDashboardSchema, parametros } from "@/lib/validaciones";
import { obtenerDashboard } from "@/server/servicios/dashboard";

export const GET = manejador("AUTENTICADO", async ({ req, usuario }) => {
  const { anio, mes, localId } = filtroDashboardSchema.parse(parametros(req.nextUrl.searchParams));
  const alcance = usuario.rol === "ADMIN" ? localId : comoVendedor(usuario).localId;
  return ok(await obtenerDashboard({ localId: alcance, anio, mes }));
});
