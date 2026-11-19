/** POST /api/compras/:id/abonos — Abono a una compra a crédito (pago al proveedor). */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { abonoProveedorSchema, idSchema } from "@/lib/validaciones";
import { registrarAbonoProveedor } from "@/server/servicios/compras";

export const POST = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const vendedor = comoVendedor(usuario);
  const datos = await leerCuerpo(req, abonoProveedorSchema);
  return ok(await registrarAbonoProveedor(vendedor, idSchema.parse(params.id), datos), 201);
});
