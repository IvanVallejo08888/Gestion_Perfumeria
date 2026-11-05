/**
 * Funciones de formato (dinero, fechas, textos).
 * Se pueden usar tanto en el servidor como en el navegador.
 * Todas las fechas se muestran en hora de Colombia.
 */

export const ZONA_HORARIA = "America/Bogota";

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** 150000 → "$ 150.000" */
export function pesos(valor: number): string {
  return formatoPesos.format(valor);
}

/** Fecha corta: "05/11/2026" */
export function fecha(valor: Date | string): string {
  return new Date(valor).toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Fecha y hora legible: "5 nov 2026, 3:30 p. m." */
export function fechaHora(valor: Date | string): string {
  return new Date(valor).toLocaleString("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Fecha larga: "jueves, 5 de noviembre de 2026" */
export function fechaLarga(valor: Date | string): string {
  return new Date(valor).toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Número de factura con ceros a la izquierda: 7 → "000007" */
export function numeroFactura(numero: number): string {
  return String(numero).padStart(6, "0");
}

/** Quita tildes y pasa a minúsculas: "Perfúme ROSA" → "perfume rosa" */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve año y mes (1-12) de una fecha según la hora de Colombia. */
export function anioMesColombia(valor: Date): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "numeric",
  }).formatToParts(valor);
  return {
    anio: Number(partes.find((p) => p.type === "year")?.value),
    mes: Number(partes.find((p) => p.type === "month")?.value),
  };
}

/**
 * Rango [inicio, fin) de un mes o de un año completo en hora de Colombia (UTC-5, sin horario de verano).
 * Si "mes" no se indica, devuelve el año entero.
 */
export function rangoPeriodo(anio: number, mes?: number): { inicio: Date; fin: Date } {
  const dos = (n: number) => String(n).padStart(2, "0");
  if (mes) {
    const inicio = new Date(`${anio}-${dos(mes)}-01T00:00:00-05:00`);
    const fin = mes === 12 ? new Date(`${anio + 1}-01-01T00:00:00-05:00`) : new Date(`${anio}-${dos(mes + 1)}-01T00:00:00-05:00`);
    return { inicio, fin };
  }
  return {
    inicio: new Date(`${anio}-01-01T00:00:00-05:00`),
    fin: new Date(`${anio + 1}-01-01T00:00:00-05:00`),
  };
}

/** Convierte una fecha a "AAAA-MM-DDTHH:mm" en hora local del navegador (para <input type="datetime-local">). */
export function aInputFechaHora(valor: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${valor.getFullYear()}-${dos(valor.getMonth() + 1)}-${dos(valor.getDate())}T${dos(valor.getHours())}:${dos(valor.getMinutes())}`;
}
