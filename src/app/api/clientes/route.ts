/**
 * GET /api/clientes?q=&pagina= — Clientes del local del vendedor, 10 por página.
 * Devuelve { clientes, total, pagina, totalPaginas, coincidenciaExacta }.
 * El conteo y los totales se calculan en SQL.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { filtroClientesSchema, parametros } from "@/lib/validaciones";
import { listarClientes } from "@/server/servicios/clientes";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { q, pagina } = filtroClientesSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarClientes(localId, q, pagina));
});
