/** PUT: editar datos de un vendedor · DELETE: eliminar un vendedor. */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { editarUsuarioSchema } from "@/lib/validaciones";
import { editarUsuario, eliminarUsuario } from "@/server/servicios/usuarios";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const datos = await leerCuerpo(req, editarUsuarioSchema);
  await editarUsuario(params.id, datos);
  return ok({ ok: true });
});

export const DELETE = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  await eliminarUsuario(params.id);
  return ok({ ok: true });
});
