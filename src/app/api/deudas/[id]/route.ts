/** GET /api/deudas/:id — Detalle de una deuda del local: cuotas, pagos (también anulados) y cierre. 404 si es de otro local. */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { idSchema } from "@/lib/validaciones";
import { obtenerDeuda } from "@/server/servicios/deudas";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ deuda: await obtenerDeuda(localId, idSchema.parse(params.id)) });
});
