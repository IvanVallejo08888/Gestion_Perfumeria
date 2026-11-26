/**
 * Reglas del valor de las cuotas (crédito de la factura y plan de pagos de una deuda).
 * La persona escribe el valor de cada cuota (o activa "Distribuir automáticamente").
 * Las usan el navegador (para avisar al instante) y el servidor, que revisa los valores
 * contra el total que ÉL calcula: nunca confía en lo que envía el navegador.
 * El reparto en partes iguales y la revisión de la suma viven en ./deudas (no se duplican).
 */
import { repartirEnCuotas, validarPlanCuotas } from "./deudas";

/**
 * "Distribuir automáticamente": la cuota 1 la escribe la persona y lo que queda del total
 * se reparte en partes iguales entre las cuotas 2..N (la última absorbe el redondeo).
 * Si la cuota 1 está vacía o ya cubre el total, las demás quedan en 0.
 */
export function repartirDespuesDeLaPrimera(total: number, primera: number, cantidad: number): number[] {
  if (cantidad <= 0) return [];
  const resto = total - primera;
  const demas = primera > 0 && resto > 0 ? repartirEnCuotas(resto, cantidad - 1) : Array<number>(cantidad - 1).fill(0);
  return [primera, ...demas];
}

/** Ajusta la lista al nuevo número de cuotas: conserva lo escrito y deja en 0 las nuevas. */
export function ajustarCantidadValores(valores: number[], cantidad: number): number[] {
  return Array.from({ length: cantidad }, (_, i) => valores[i] ?? 0);
}

export interface ResumenCuotas {
  asignado: number;
  /** Positivo: falta por asignar. Negativo: sobra. */
  diferencia: number;
  /** Números (1, 2…) de las cuotas que siguen en 0. */
  sinValor: number[];
}

export function resumirCuotas(valores: number[], total: number): ResumenCuotas {
  const asignado = valores.reduce((s, v) => s + v, 0);
  const sinValor = valores.flatMap((v, i) => (v > 0 ? [] : [i + 1]));
  return { asignado, diferencia: total - asignado, sinValor };
}

/**
 * Mensaje para la persona si los valores no cuadran con el total (null si todo está bien).
 * Primero dice QUÉ cuotas faltan por escribir; la suma la revisa validarPlanCuotas.
 */
export function revisarValoresCuotas(valores: number[], total: number): string | null {
  if (valores.length === 0) return "Un crédito debe tener al menos una cuota.";
  if (valores.some((v) => !Number.isInteger(v) || v < 0)) return "El valor de cada cuota debe ser un número entero positivo.";
  const { sinValor } = resumirCuotas(valores, total);
  if (sinValor.length === 1) return `Escribe el valor de la cuota ${sinValor[0]}.`;
  if (sinValor.length > 1) return `Escribe el valor de las cuotas ${sinValor.join(", ")}.`;
  return validarPlanCuotas(total, valores);
}
