/**
 * PUT /api/admin/sectores/:id — Renombrar, activar o desactivar un sector.
 * DELETE — Eliminar un sector. Si ya se usó en facturas, solo se desactiva.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { editarSectorSchema, idSchema } from "@/lib/validaciones";
import { editarSector, eliminarSector } from "@/server/servicios/sectores";

export const PUT = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const datos = await leerCuerpo(req, editarSectorSchema);
  await editarSector(idSchema.parse(params.id), datos);
  return ok({ ok: true });
});

export const DELETE = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  return ok({ resultado: await eliminarSector(idSchema.parse(params.id)) });
});
