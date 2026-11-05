/** GET /api/productos?q= — Inventario del local · POST — Crear producto. */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { productoSchema } from "@/lib/validaciones";
import { crearProducto, listarProductos } from "@/server/servicios/productos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const texto = req.nextUrl.searchParams.get("q") ?? undefined;
  return ok({ productos: await listarProductos(localId, texto) });
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const datos = await leerCuerpo(req, productoSchema);
  return ok({ producto: await crearProducto(localId, datos) }, 201);
});
