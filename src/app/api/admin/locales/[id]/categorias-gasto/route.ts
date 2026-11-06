/**
 * GET /api/admin/locales/:id/categorias-gasto — Todas las categorías de gastos del local.
 * POST — Agregar una o varias categorías: { nombres: string[] }.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { agregarCategoriasSchema, idSchema } from "@/lib/validaciones";
import { agregarCategorias, listarCategorias } from "@/server/servicios/gastos";

export const GET = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  return ok({ categorias: await listarCategorias(idSchema.parse(params.id)) });
});

export const POST = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const { nombres } = await leerCuerpo(req, agregarCategoriasSchema);
  return ok(await agregarCategorias(idSchema.parse(params.id), nombres), 201);
});
