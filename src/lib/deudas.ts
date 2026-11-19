/**
 * Reglas de las deudas del negocio (gastos a crédito), compartidas por el navegador y el servidor.
 * Son funciones puras: tienen pruebas en deudas.test.ts.
 *
 * Regla contable (ver README, «Gastos a crédito y deudas»):
 *  - Registrar un gasto a crédito NO saca dinero de la caja: solo crea la deuda.
 *  - El dinero sale con cada pago, el día del pago y con su medio.
 *  - Gastos del periodo = gastos de contado + pagos de deudas del periodo.
 *    El valor total de la deuda nunca se suma como gasto.
 */
import { ZONA_HORARIA } from "./formato";

/** Máximo de cuotas de una deuda. */
export const MAXIMO_CUOTAS_DEUDA = 60;

/** Días de anticipación para avisar de un pago próximo (igual que los cobros a clientes). */
export const DIAS_AVISO_PAGO = 3;

export type EstadoDeuda = "PENDIENTE" | "PAGADA" | "ANULADA";
export type MedioPagoDeuda = "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";

export const TEXTO_ESTADO_DEUDA: Record<EstadoDeuda, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

/* ------------------------------ Plan de cuotas ------------------------------ */

/**
 * Reparte un total en cuotas iguales; la ÚLTIMA ajusta la diferencia del redondeo.
 * Ej.: 1.000.000 en 3 → 333.333 + 333.333 + 333.334.
 */
export function repartirEnCuotas(total: number, cantidad: number): number[] {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return [];
  const base = Math.floor(total / cantidad);
  return Array.from({ length: cantidad }, (_, i) => (i === cantidad - 1 ? total - base * (cantidad - 1) : base));
}

/**
 * Revisa el plan de cuotas de una deuda. Devuelve el mensaje de error para la persona, o null si está bien.
 * Las fechas pasadas SÍ se permiten (sirven para registrar deudas antiguas).
 */
export function validarPlanCuotas(total: number, valores: number[]): string | null {
  if (valores.length < 1) return "La deuda debe tener al menos una cuota.";
  if (valores.length > MAXIMO_CUOTAS_DEUDA) return `Máximo ${MAXIMO_CUOTAS_DEUDA} cuotas.`;
  if (valores.some((v) => !Number.isInteger(v) || v <= 0)) return "Cada cuota debe ser mayor que cero.";
  const suma = valores.reduce((a, v) => a + v, 0);
  if (suma !== total) {
    const diferencia = total - suma;
    const texto = Math.abs(diferencia).toLocaleString("es-CO");
    return diferencia > 0
      ? `Las cuotas suman $ ${suma.toLocaleString("es-CO")}: faltan $ ${texto} para llegar al total.`
      : `Las cuotas suman $ ${suma.toLocaleString("es-CO")}: sobran $ ${texto} sobre el total.`;
  }
  return null;
}

/* ------------------------- Aplicar pagos a las cuotas ------------------------- */

export interface CuotaPlan {
  id: string;
  numero: number;
  valor: number;
}

export interface PagoAplicable {
  valor: number;
  /** Fecha del pago: los pagos se aplican en orden de fecha. */
  fecha: Date;
}

export interface CuotaCalculada extends CuotaPlan {
  valorPagado: number;
  estado: "PENDIENTE" | "PAGADA";
  /** Fecha del pago que terminó de cubrir la cuota (null si sigue pendiente). */
  pagadaEn: Date | null;
}

/**
 * Calcula cómo quedan las cuotas DESDE CERO con los pagos vigentes:
 * se aplican en orden de fecha a las cuotas en orden de número (primero la más antigua).
 * Se usa al pagar y al anular un pago: así las cuotas siempre cuadran con los pagos que existen.
 */
export function aplicarPagosACuotas(cuotas: CuotaPlan[], pagos: PagoAplicable[]): CuotaCalculada[] {
  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero);
  const resultado: CuotaCalculada[] = ordenadas.map((c) => ({ ...c, valorPagado: 0, estado: "PENDIENTE", pagadaEn: null }));
  const enOrden = [...pagos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  let i = 0;
  for (const pago of enOrden) {
    let restante = pago.valor;
    while (restante > 0 && i < resultado.length) {
      const cuota = resultado[i];
      const aplicado = Math.min(cuota.valor - cuota.valorPagado, restante);
      cuota.valorPagado += aplicado;
      restante -= aplicado;
      if (cuota.valorPagado >= cuota.valor) {
        cuota.estado = "PAGADA";
        cuota.pagadaEn = pago.fecha;
        i++;
      }
    }
  }
  return resultado;
}

/**
 * Revisa el valor de un pago contra el saldo. Devuelve el mensaje de error o null.
 */
export function validarPagoDeuda(saldo: number, valor: number): string | null {
  if (saldo <= 0) return "Esta deuda ya está pagada por completo.";
  if (!Number.isInteger(valor) || valor <= 0) return "El pago debe ser mayor que cero.";
  if (valor > saldo) return `El pago no puede ser mayor que el saldo pendiente ($ ${saldo.toLocaleString("es-CO")}).`;
  return null;
}

/* ------------------------- Forma de pago de la deuda ------------------------- */

export interface ResumenMedioPago {
  medio: MedioPagoDeuda;
  totalEfectivo: number;
  totalTransferencia: number;
}

/**
 * Cómo se pagó la deuda en total, según la suma de sus pagos vigentes:
 * todo en efectivo → EFECTIVO; todo por transferencia → TRANSFERENCIA; parte y parte → MIXTO.
 * Devuelve null si no hay pagos.
 */
export function calcularResumenMedioPago(pagos: { valorEfectivo: number; valorTransferencia: number }[]): ResumenMedioPago | null {
  if (pagos.length === 0) return null;
  const totalEfectivo = pagos.reduce((a, p) => a + p.valorEfectivo, 0);
  const totalTransferencia = pagos.reduce((a, p) => a + p.valorTransferencia, 0);
  if (totalEfectivo + totalTransferencia === 0) return null;
  const medio: MedioPagoDeuda = totalTransferencia === 0 ? "EFECTIVO" : totalEfectivo === 0 ? "TRANSFERENCIA" : "MIXTO";
  return { medio, totalEfectivo, totalTransferencia };
}

/** Texto del cierre de la deuda: «Gastos en efectivo», «Gastos por transferencia» o «Mixto». */
export function textoFormaPagoFinal(medio: MedioPagoDeuda): string {
  if (medio === "EFECTIVO") return "Gastos en efectivo";
  if (medio === "TRANSFERENCIA") return "Gastos por transferencia";
  return "Mixto";
}

/* --------------------------- Recordatorios de pago --------------------------- */

export type NivelRecordatorio = "VENCIDA" | "HOY" | "PROXIMA";

const diaColombia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA }); // AAAA-MM-DD

/**
 * Nivel de un recordatorio (cobro a un cliente o pago de una deuda), en hora de Colombia:
 *  - VENCIDA: el día ya pasó, o es hoy y la hora ya pasó.
 *  - HOY: vence hoy, más tarde.
 *  - PROXIMA: vence dentro de los próximos días (el llamador decide el límite).
 */
export function nivelRecordatorio(vence: Date, ahora: Date = new Date()): NivelRecordatorio {
  const dia = diaColombia(vence);
  const hoy = diaColombia(ahora);
  if (dia < hoy || (dia === hoy && vence < ahora)) return "VENCIDA";
  return dia === hoy ? "HOY" : "PROXIMA";
}

/** ¿La cuota ya está vencida? (se usa para el aviso «Esta cuota ya está vencida» y el texto en rojo). */
export function estaVencida(vence: Date, ahora: Date = new Date()): boolean {
  return vence.getTime() < ahora.getTime();
}
