/** GET /api/notificaciones/conteo — Número para la campana del menú (se consulta cada minuto). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { contarNotificaciones } from "@/server/servicios/notificaciones";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok(await contarNotificaciones(localId));
});
