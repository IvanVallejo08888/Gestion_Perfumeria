/**
 * POST /api/gastos/:id/anular — "Eliminar gasto" (vendedor).
 * Cuerpo: { motivo } (obligatorio, de 5 a 200 caracteres).
 * El gasto no se borra: queda anulado con el motivo, quién y cuándo. Solo gastos del local del vendedor.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, motivoAnulacionSchema } from "@/lib/validaciones";
import { anularGasto } from "@/server/servicios/gastos";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const { motivo } = await leerCuerpo(req, motivoAnulacionSchema);
  return ok({ gasto: await anularGasto(vendedor, id, motivo, vendedor.localId) });
});
