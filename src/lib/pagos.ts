/**
 * Reglas del medio de pago (Efectivo / Transferencia / Mixto).
 * Las usan tanto el navegador (para mostrar el efectivo al instante) como el servidor,
 * que SIEMPRE recalcula los valores y nunca confía en lo que envía el navegador.
 */
import type { MedioPago, MedioPagoGasto } from "@/tipos";

export const MEDIOS_PAGO: { valor: MedioPago; texto: string }[] = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "MIXTO", texto: "Mixto" },
];

/** Los gastos no se dividen: se pagan en efectivo o por transferencia. */
export const MEDIOS_PAGO_GASTO = MEDIOS_PAGO.filter((m) => m.valor !== "MIXTO") as { valor: MedioPagoGasto; texto: string }[];

/** "EFECTIVO" → "Efectivo". */
export function textoMedioPago(medio: MedioPago): string {
  return MEDIOS_PAGO.find((m) => m.valor === medio)?.texto ?? medio;
}

export interface RepartoPago {
  valorEfectivo: number;
  valorTransferencia: number;
  /** Mensaje para la persona si los valores no son válidos (null si todo está bien). */
  error: string | null;
}

/**
 * Reparte un total entre efectivo y transferencia.
 * En Mixto la persona escribe la transferencia y el efectivo es lo que falta para el total.
 */
export function calcularPago(medio: MedioPago, total: number, transferencia = 0): RepartoPago {
  if (medio === "EFECTIVO") return { valorEfectivo: total, valorTransferencia: 0, error: null };
  if (medio === "TRANSFERENCIA") return { valorEfectivo: 0, valorTransferencia: total, error: null };

  const reparto = { valorEfectivo: total - transferencia, valorTransferencia: transferencia };
  if (transferencia <= 0) return { ...reparto, error: "Escribe el valor de la transferencia." };
  if (transferencia >= total) return { ...reparto, error: "La transferencia debe ser menor que el total." };
  return { ...reparto, error: null };
}
