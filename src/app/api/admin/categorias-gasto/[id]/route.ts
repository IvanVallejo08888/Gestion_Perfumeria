/** PUT /api/admin/categorias-gasto/:id — Renombrar, activar o desactivar una categoría de gastos. */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { editarCategoriaSchema, idSchema } from "@/lib/validaciones";
import { editarCategoria } from "@/server/servicios/gastos";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const datos = await leerCuerpo(req, editarCategoriaSchema);
  await editarCategoria(idSchema.parse(params.id), datos);
  return ok({ ok: true });
});
