/**
 * Validación en el servidor del medio de pago de facturas y abonos.
 * El reparto se calcula aquí con el total real; si el navegador envió otros valores,
 * el pago se rechaza en lugar de guardar cifras que no cuadran.
 */
import "server-only";
import { ApiError } from "@/lib/api";
import { calcularPago } from "@/lib/pagos";
import type { MedioPago } from "@/tipos";

export interface DatosPago {
  medioPago: MedioPago;
  valorTransferencia?: number;
  valorEfectivo?: number;
}

/** Devuelve lo que se guarda en la base de datos, o lanza un error 400 si no cuadra. */
export function resolverPago(datos: DatosPago, total: number) {
  const { valorEfectivo, valorTransferencia, error } = calcularPago(datos.medioPago, total, datos.valorTransferencia);
  if (error) throw new ApiError(400, error);

  const enviadoCuadra =
    (datos.valorEfectivo === undefined || datos.valorEfectivo === valorEfectivo) &&
    (datos.valorTransferencia === undefined || datos.valorTransferencia === valorTransferencia);
  if (!enviadoCuadra) {
    throw new ApiError(400, "Los valores del pago no cuadran con el total. Revisa el efectivo y la transferencia.");
  }
  return { medioPago: datos.medioPago, valorEfectivo, valorTransferencia };
}
