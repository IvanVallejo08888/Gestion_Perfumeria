/**
 * Reglas de las compras de mercancía y de las cuentas por pagar a proveedores
 * (se usan igual en el navegador y en el servidor).
 *  - De contado (efectivo o transferencia): la compra queda SALDADA, sin saldo.
 *  - A crédito: el saldo es el total y baja con cada abono; en 0 pasa a SALDADA.
 */
import type { EstadoCuentaPagar, MedioPagoCompra } from "@/tipos";

export const MEDIOS_PAGO_COMPRA: readonly { valor: MedioPagoCompra; texto: string }[] = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CREDITO", texto: "Crédito con el proveedor" },
];

export function textoMedioPagoCompra(medio: MedioPagoCompra): string {
  return MEDIOS_PAGO_COMPRA.find((m) => m.valor === medio)?.texto ?? medio;
}

export function textoEstadoCuenta(estado: EstadoCuentaPagar): string {
  return estado === "SALDADA" ? "Saldada" : "Pendiente";
}

/** Saldo y estado con que nace una compra. */
export function estadoInicialCompra(medioPago: MedioPagoCompra, total: number): { saldo: number; estado: EstadoCuentaPagar } {
  return medioPago === "CREDITO" ? { saldo: total, estado: "PENDIENTE" } : { saldo: 0, estado: "SALDADA" };
}

/**
 * Aplica un abono al saldo de una compra a crédito.
 * Devuelve el nuevo saldo y estado, o un mensaje de error para el usuario.
 */
export function aplicarAbonoProveedor(
  saldo: number,
  valor: number,
): { nuevoSaldo: number; estado: EstadoCuentaPagar; error?: undefined } | { error: string } {
  if (saldo <= 0) return { error: "Esta compra ya está saldada: no se le debe nada al proveedor." };
  if (!Number.isInteger(valor) || valor <= 0) return { error: "El abono debe ser mayor que cero." };
  if (valor > saldo) return { error: `El abono no puede ser mayor que el saldo pendiente ($ ${saldo.toLocaleString("es-CO")}).` };
  const nuevoSaldo = saldo - valor;
  return { nuevoSaldo, estado: nuevoSaldo === 0 ? "SALDADA" : "PENDIENTE" };
}
