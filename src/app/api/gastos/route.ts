/**
 * GET /api/gastos?anio=&mes=&categoriaId=&estado= — Gastos del local del vendedor, con sus totales.
 *   (estado=eliminados: solo los gastos anulados; los totales siempre son de los vigentes)
 * POST /api/gastos — Registrar un gasto.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { filtroGastosSchema, gastoSchema, parametros } from "@/lib/validaciones";
import { crearGasto, listarGastos } from "@/server/servicios/gastos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const filtros = filtroGastosSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarGastos(localId, filtros));
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const vendedor = comoVendedor(usuario);
  await crearGasto(vendedor, await leerCuerpo(req, gastoSchema));
  return ok({ ok: true }, 201);
});
