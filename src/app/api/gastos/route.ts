/**
 * GET /api/gastos?anio=&mes=&categoriaId= — Gastos del local del vendedor, con sus totales.
 * POST /api/gastos — Registrar un gasto.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { filtroGastosSchema, gastoSchema, parametros } from "@/lib/validaciones";
import { crearGasto, listarGastos } from "@/server/servicios/gastos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId, id } = comoVendedor(usuario);
  const filtros = filtroGastosSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarGastos(localId, filtros, id));
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const vendedor = comoVendedor(usuario);
  await crearGasto(vendedor, await leerCuerpo(req, gastoSchema));
  return ok({ ok: true }, 201);
});
