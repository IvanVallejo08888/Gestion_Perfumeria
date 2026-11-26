/**
 * GET /api/deudas?estado=PENDIENTE|PAGADA|ANULADA — Deudas del local del vendedor (gastos a crédito),
 * con el resumen de las pendientes: total adeudado, próximo pago y cuotas vencidas.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { filtroDeudasSchema, parametros } from "@/lib/validaciones";
import { listarDeudas } from "@/server/servicios/deudas";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { estado } = filtroDeudasSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await listarDeudas(localId, estado));
});
