/**
 * GET /api/caja?fecha=AAAA-MM-DD — Caja del día del local del vendedor:
 * entradas (ventas de contado y abonos), salidas (gastos de contado y pagos de deudas),
 * saldo en efectivo y transferencia, y el detalle de cada movimiento.
 */
import { ApiError, comoVendedor, manejador, ok } from "@/lib/api";
import { hoyColombia } from "@/lib/formato";
import { cajaSchema, parametros } from "@/lib/validaciones";
import { obtenerCaja } from "@/server/servicios/caja";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { fecha } = cajaSchema.parse(parametros(req.nextUrl.searchParams));
  if (fecha > hoyColombia()) throw new ApiError(400, "Elige un día que ya haya llegado.");
  return ok(await obtenerCaja(localId, fecha));
});
