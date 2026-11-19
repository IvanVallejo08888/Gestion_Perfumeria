/**
 * GET /api/proveedores/:id — Ficha del proveedor: datos, deuda, compras y abonos.
 * PUT /api/proveedores/:id — Editar el proveedor (o desactivarlo).
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, proveedorSchema } from "@/lib/validaciones";
import { editarProveedor, obtenerProveedorDetalle } from "@/server/servicios/proveedores";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ proveedor: await obtenerProveedorDetalle(localId, idSchema.parse(params.id)) });
});

export const PUT = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const datos = await leerCuerpo(req, proveedorSchema);
  return ok({ proveedor: await editarProveedor(localId, idSchema.parse(params.id), datos) });
});
