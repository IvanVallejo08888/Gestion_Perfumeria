/**
 * GET /api/creditos/abonos/:id — Comprobante de un abono del local del vendedor
 * (con el saldo y el total abonado tal como quedaron justo después de ese abono).
 * Si el abono es de otro local o no existe: 404.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { obtenerComprobanteAbono } from "@/server/servicios/creditos";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ abono: await obtenerComprobanteAbono(localId, params.id) });
});
