/**
 * POST /api/facturas/:id/anular — "Eliminar venta".
 * Cuerpo: { motivo } (obligatorio, de 5 a 200 caracteres).
 * La factura no se borra: se anula, los productos regresan al inventario y,
 * si es un crédito, sus cuotas y abonos quedan anulados. Solo facturas del local del vendedor.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, motivoAnulacionSchema } from "@/lib/validaciones";
import { anularFactura } from "@/server/servicios/facturas";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const { motivo } = await leerCuerpo(req, motivoAnulacionSchema);
  return ok({ resultado: await anularFactura(vendedor, id, motivo) });
});
