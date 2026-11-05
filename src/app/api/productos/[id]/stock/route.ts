/** POST /api/productos/:id/stock — Suma (número positivo) o resta (número negativo) unidades. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { ajusteStockSchema } from "@/lib/validaciones";
import { ajustarStock } from "@/server/servicios/productos";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const { cantidad } = await leerCuerpo(req, ajusteStockSchema);
  return ok({ producto: await ajustarStock(localId, params.id, cantidad) });
});
