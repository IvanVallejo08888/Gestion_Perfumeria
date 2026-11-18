/** GET /api/productos/:id/movimientos — Últimos 20 movimientos del perfume (detalle). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarMovimientos } from "@/server/servicios/movimientos";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ movimientos: await listarMovimientos(localId, params.id) });
});
