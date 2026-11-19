/**
 * POST /api/deudas/pagos/:id/anular — Anular un pago hecho por error. Cuerpo: { motivo } (5 a 200 caracteres).
 * El pago se conserva marcado; las cuotas y el saldo se recalculan y una deuda PAGADA vuelve a PENDIENTE.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, motivoAnulacionSchema } from "@/lib/validaciones";
import { anularPagoDeuda } from "@/server/servicios/deudas";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const { motivo } = await leerCuerpo(req, motivoAnulacionSchema);
  return ok({ deuda: await anularPagoDeuda(vendedor, vendedor.localId, id, motivo) });
});
