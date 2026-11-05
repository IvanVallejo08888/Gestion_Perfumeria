/** PUT /api/admin/usuarios/:id/password — El administrador cambia la contraseña de un vendedor. */
import { ApiError, leerCuerpo, manejador, ok } from "@/lib/api";
import { cambiarPasswordSchema } from "@/lib/validaciones";
import { cambiarPassword } from "@/server/servicios/usuarios";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params, usuario }) => {
  // Para su propia cuenta, el administrador usa "Mi cuenta" (pide la contraseña actual)
  if (params.id === usuario.id) throw new ApiError(400, "Cambia tu contraseña desde la opción «Mi cuenta».");
  const { password } = await leerCuerpo(req, cambiarPasswordSchema);
  await cambiarPassword(params.id, password);
  return ok({ ok: true });
});
