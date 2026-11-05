/** PUT /api/admin/locales/:id — Editar nombre, dirección, teléfono o activar/desactivar un local. */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { localSchema } from "@/lib/validaciones";
import { editarLocal } from "@/server/servicios/locales";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const datos = await leerCuerpo(req, localSchema);
  await editarLocal(params.id, datos);
  return ok({ ok: true });
});
