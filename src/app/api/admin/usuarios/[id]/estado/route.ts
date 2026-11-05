/** PUT /api/admin/usuarios/:id/estado — Pausar (cierra su sesión al instante) o reactivar un vendedor. */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { cambiarEstadoSchema } from "@/lib/validaciones";
import { cambiarEstado } from "@/server/servicios/usuarios";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const { estado } = await leerCuerpo(req, cambiarEstadoSchema);
  await cambiarEstado(params.id, estado);
  return ok({ ok: true });
});
