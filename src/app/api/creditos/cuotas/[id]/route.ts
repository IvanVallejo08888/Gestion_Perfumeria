/** PUT /api/creditos/cuotas/:id — Cambiar la fecha y hora de cobro de una cuota pendiente. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { cuotaSchema } from "@/lib/validaciones";
import { cambiarFechaCuota } from "@/server/servicios/creditos";

export const PUT = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const { fechaVencimiento } = await leerCuerpo(req, cuotaSchema);
  await cambiarFechaCuota(localId, params.id, new Date(fechaVencimiento));
  return ok({ ok: true });
});
