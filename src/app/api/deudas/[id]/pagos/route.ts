/**
 * POST /api/deudas/:id/pagos — Pagar (abonar) una deuda.
 * Cuerpo: { valor, medioPago, valorTransferencia?, valorEfectivo?, fecha?, nota? }.
 * El pago sale de la caja del día del pago. Si el saldo llega a 0, la deuda queda PAGADA (quedoPagada: true).
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, pagoDeudaSchema } from "@/lib/validaciones";
import { registrarPagoDeuda } from "@/server/servicios/deudas";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const datos = await leerCuerpo(req, pagoDeudaSchema);
  return ok(await registrarPagoDeuda(vendedor, id, datos), 201);
});
