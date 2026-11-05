/** GET /api/productos/buscar?q= — Buscador inteligente para la factura (incluye el stock disponible). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { buscarParaVenta } from "@/server/servicios/productos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const texto = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return ok({ productos: await buscarParaVenta(localId, texto) });
});
