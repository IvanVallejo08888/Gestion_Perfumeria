/** GET: lista de locales · POST: crear un local nuevo (solo administrador). */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { localSchema } from "@/lib/validaciones";
import { crearLocal, listarLocales } from "@/server/servicios/locales";

export const GET = manejador("ADMIN", async () => ok({ locales: await listarLocales() }));

export const POST = manejador("ADMIN", async ({ req }) => {
  const datos = await leerCuerpo(req, localSchema);
  return ok({ local: await crearLocal(datos) }, 201);
});
