/** GET /api/facturas/:id — Detalle completo de una factura (productos, cuotas y abonos). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { obtenerFactura } from "@/server/servicios/facturas";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ factura: await obtenerFactura(localId, params.id) });
});
