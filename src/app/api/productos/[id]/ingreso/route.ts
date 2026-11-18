/** POST /api/productos/:id/ingreso — Llegó mercancía: suma unidades (movimiento INGRESO, nota opcional). */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { ingresoStockSchema } from "@/lib/validaciones";
import { agregarUnidades } from "@/server/servicios/productos";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const datos = await leerCuerpo(req, ingresoStockSchema);
  return ok({ producto: await agregarUnidades(vendedor.localId, params.id, datos, vendedor) });
});
