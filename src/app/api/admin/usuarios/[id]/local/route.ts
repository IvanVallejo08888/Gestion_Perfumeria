/** PUT /api/admin/usuarios/:id/local — Asigna un local al vendedor (si estaba pendiente, queda activo). */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { asignarLocalSchema } from "@/lib/validaciones";
import { asignarLocal } from "@/server/servicios/usuarios";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const { localId } = await leerCuerpo(req, asignarLocalSchema);
  await asignarLocal(params.id, localId);
  return ok({ ok: true });
});
