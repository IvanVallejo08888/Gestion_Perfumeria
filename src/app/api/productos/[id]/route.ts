/**
 * GET — Producto para cargarlo en la factura ("Vender" desde el inventario).
 * PUT — Editar producto (no cambia el stock) · DELETE — Eliminar producto (si tiene ventas, solo se oculta).
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { productoSchema } from "@/lib/validaciones";
import { editarProducto, eliminarProducto, obtenerProductoVenta } from "@/server/servicios/productos";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ producto: await obtenerProductoVenta(localId, params.id) });
});

export const PUT = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  await editarProducto(localId, params.id, await leerCuerpo(req, productoSchema));
  return ok({ ok: true });
});

export const DELETE = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  await eliminarProducto(localId, params.id);
  return ok({ ok: true });
});
