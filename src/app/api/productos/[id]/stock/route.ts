/** POST /api/productos/:id/stock — Ajuste manual: suma (positivo) o resta (negativo) unidades con motivo obligatorio. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { ajusteStockSchema } from "@/lib/validaciones";
import { ajustarStock } from "@/server/servicios/productos";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const datos = await leerCuerpo(req, ajusteStockSchema);
  return ok({ producto: await ajustarStock(vendedor.localId, params.id, datos, vendedor) });
});
