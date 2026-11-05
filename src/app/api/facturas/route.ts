/**
 * GET /api/facturas?estado=&tipo=&q=&pagina= — Historial de ventas del local.
 * POST /api/facturas — Registrar factura normal o de crédito (descuenta el inventario).
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { crearFacturaSchema } from "@/lib/validaciones";
import { crearFactura, listarFacturas, obtenerFactura } from "@/server/servicios/facturas";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const p = req.nextUrl.searchParams;
  return ok(
    await listarFacturas(localId, {
      estado: p.get("estado") ?? undefined,
      tipo: p.get("tipo") ?? undefined,
      texto: p.get("q") ?? undefined,
      pagina: Number(p.get("pagina") ?? 1) || 1,
    }),
  );
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const vendedor = comoVendedor(usuario);
  const datos = await leerCuerpo(req, crearFacturaSchema);
  const id = await crearFactura(vendedor, datos);
  return ok({ factura: await obtenerFactura(vendedor.localId, id) }, 201);
});
