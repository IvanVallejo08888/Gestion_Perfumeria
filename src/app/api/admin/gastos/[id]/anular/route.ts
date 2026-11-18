/**
 * POST /api/admin/gastos/:id/anular — "Eliminar gasto" desde Reportes (administrador).
 * Cuerpo: { motivo } (obligatorio, de 5 a 200 caracteres). Sirve para gastos de cualquier local.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { idSchema, motivoAnulacionSchema } from "@/lib/validaciones";
import { anularGasto } from "@/server/servicios/gastos";

export const POST = manejador<{ id: string }>("ADMIN", async ({ req, usuario, params }) => {
  const id = idSchema.parse(params.id);
  const { motivo } = await leerCuerpo(req, motivoAnulacionSchema);
  return ok({ gasto: await anularGasto(usuario, id, motivo, null) });
});
