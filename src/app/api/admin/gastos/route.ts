/** GET /api/admin/gastos?localId=&anio=&mes= — Gastos de cualquier local (vista del administrador). */
import { z } from "zod";
import { manejador, ok } from "@/lib/api";
import { filtroGastosSchema, parametros } from "@/lib/validaciones";
import { listarGastos } from "@/server/servicios/gastos";

const consulta = filtroGastosSchema.extend({ localId: z.uuid("Selecciona un local.") });

export const GET = manejador("ADMIN", async ({ req }) => {
  const { localId, ...filtros } = consulta.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarGastos(localId, filtros));
});
