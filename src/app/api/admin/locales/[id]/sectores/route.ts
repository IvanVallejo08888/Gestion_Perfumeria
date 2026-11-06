/**
 * GET /api/admin/locales/:id/sectores — Todos los sectores del local (también los desactivados).
 * POST — Agregar uno o varios sectores: { nombres: string[] }.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { agregarSectoresSchema, idSchema } from "@/lib/validaciones";
import { agregarSectores, listarSectores } from "@/server/servicios/sectores";

export const GET = manejador<{ id: string }>("ADMIN", async ({ params }) => {
  return ok({ sectores: await listarSectores(idSchema.parse(params.id)) });
});

export const POST = manejador<{ id: string }>("ADMIN", async ({ req, params }) => {
  const { nombres } = await leerCuerpo(req, agregarSectoresSchema);
  return ok(await agregarSectores(idSchema.parse(params.id), nombres), 201);
});
