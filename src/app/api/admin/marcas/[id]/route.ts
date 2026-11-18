/**
 * PUT /api/admin/marcas/:id — Renombrar, activar o desactivar una marca.
 * DELETE — Eliminar una marca. Si ya se usó en productos, solo se desactiva.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { editarMarcaSchema, idSchema } from "@/lib/validaciones";
import { editarMarca, eliminarMarca } from "@/server/servicios/marcas";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const datos = await leerCuerpo(req, editarMarcaSchema);
  await editarMarca(idSchema.parse(params.id), datos);
  return ok({ ok: true });
});

export const DELETE = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  return ok({ resultado: await eliminarMarca(idSchema.parse(params.id)) });
});
