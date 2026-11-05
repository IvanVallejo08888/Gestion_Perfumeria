/** GET /api/notificaciones — Cobros vencidos/próximos y productos con poco stock. */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarNotificaciones } from "@/server/servicios/notificaciones";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ notificaciones: await listarNotificaciones(localId) });
});
