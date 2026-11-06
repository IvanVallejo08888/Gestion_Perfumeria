/** DELETE /api/gastos/:id — Eliminar un gasto propio registrado hoy. */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { idSchema } from "@/lib/validaciones";
import { eliminarGasto } from "@/server/servicios/gastos";

export const DELETE = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  await eliminarGasto(comoVendedor(usuario), idSchema.parse(params.id));
  return ok({ ok: true });
});
