/** GET /api/admin/resumen — Números para la pantalla de inicio del administrador. */
import { manejador, ok } from "@/lib/api";
import { listarLocales } from "@/server/servicios/locales";
import { contarUsuariosPorEstado } from "@/server/servicios/usuarios";

export const GET = manejador("ADMIN", async () => {
  const [usuarios, locales] = await Promise.all([contarUsuariosPorEstado(), listarLocales()]);
  return ok({
    usuarios,
    locales: { total: locales.length, activos: locales.filter((l) => l.activo).length },
  });
});
