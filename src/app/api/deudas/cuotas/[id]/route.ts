/** PUT /api/deudas/cuotas/:id — Cambiar la fecha y hora de pago de una cuota pendiente. Cuerpo: { fechaVencimiento }. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { cuotaSchema, idSchema } from "@/lib/validaciones";
import { cambiarFechaCuotaDeuda } from "@/server/servicios/deudas";

export const PUT = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const { fechaVencimiento } = await leerCuerpo(req, cuotaSchema);
  return ok({ deuda: await cambiarFechaCuotaDeuda(localId, id, new Date(fechaVencimiento)) });
});
