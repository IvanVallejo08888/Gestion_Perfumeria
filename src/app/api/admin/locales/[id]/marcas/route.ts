/**
 * GET /api/admin/locales/:id/marcas — Todas las marcas del local (también las desactivadas).
 * POST — Agregar una o varias marcas: { nombres: string[] }.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { agregarMarcasSchema, idSchema } from "@/lib/validaciones";
import { agregarMarcas, listarMarcas } from "@/server/servicios/marcas";

export const GET = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  return ok({ marcas: await listarMarcas(idSchema.parse(params.id)) });
});

export const POST = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const { nombres } = await leerCuerpo(req, agregarMarcasSchema);
  return ok(await agregarMarcas(idSchema.parse(params.id), nombres), 201);
});
