/** POST /api/creditos/:id/abonos — Registrar un abono. Si el saldo llega a 0, el crédito queda COMPLETADO. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { abonoSchema } from "@/lib/validaciones";
import { registrarAbono } from "@/server/servicios/creditos";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const { valor, nota } = await leerCuerpo(req, abonoSchema);
  return ok({ factura: await registrarAbono(vendedor, params.id, valor, nota) }, 201);
});
