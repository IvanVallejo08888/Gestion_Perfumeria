/**
 * GET /api/productos?q=&genero=&publico=&marcaId=&tipo=&tamano=&stock= — Inventario del local (filtros opcionales).
 * POST — Crear producto (si trae unidades, registra el INGRESO "Stock inicial").
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { filtroProductosSchema, parametros, productoSchema } from "@/lib/validaciones";
import { crearProducto, listarProductos } from "@/server/servicios/productos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const filtros = filtroProductosSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarProductos(localId, filtros));
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const vendedor = comoVendedor(usuario);
  const datos = await leerCuerpo(req, productoSchema);
  return ok({ producto: await crearProducto(vendedor.localId, datos, vendedor) }, 201);
});
