/**
 * Reglas de la "Limpieza del sistema" (administrador), compartidas entre el navegador, el servidor
 * y el esquema de la base de datos. Son funciones puras: tienen pruebas en limpieza.test.ts.
 *
 * Sin imports con "@/": lo usa también src/db/schema.ts (drizzle-kit).
 */
import { anioMesColombia, MESES, rangoDias, rangoPeriodo } from "./formato";

/**
 * Qué se borra:
 *  - PERIODO:    ventas de contado (incluidas las anuladas) y gastos de los meses elegidos.
 *  - VENTAS:     todas las ventas de contado con sus productos vendidos.
 *  - CREDITOS:   todos los créditos con sus cuotas y abonos.
 *  - GASTOS:     todos los gastos.
 *  - CLIENTES:   los clientes SIN ventas ni créditos (los demás se conservan).
 *  - INVENTARIO: todos los productos (las facturas conservan el nombre).
 *  - TODO:       ventas, créditos, gastos, clientes e inventario.
 */
export const ALCANCES_LIMPIEZA = ["PERIODO", "VENTAS", "CREDITOS", "GASTOS", "CLIENTES", "INVENTARIO", "TODO"] as const;
export type AlcanceLimpieza = (typeof ALCANCES_LIMPIEZA)[number];

export const ETIQUETA_ALCANCE: Record<AlcanceLimpieza, string> = {
  PERIODO: "Ventas de contado y gastos del periodo",
  VENTAS: "Todas las ventas de contado",
  CREDITOS: "Todos los créditos",
  GASTOS: "Todos los gastos",
  CLIENTES: "Clientes sin ventas ni créditos",
  INVENTARIO: "Todo el inventario",
  TODO: "Todo el local",
};

/** Segundos mínimos entre dos limpiezas del mismo local (evita doble clic y reintentos). */
export const ESPERA_ENTRE_LIMPIEZAS_SEG = 30;

/** Segundos de cuenta regresiva antes de habilitar el botón final. */
export const CUENTA_REGRESIVA_SEG = 5;

/* ------------------------------- Periodo ------------------------------- */

/**
 * Meses que todavía no terminaron Y no son el actual (no se pueden limpiar).
 * Devuelve la lista de meses futuros encontrados (vacía si todo está bien).
 * Sin meses (todo el año): un año futuro no se permite.
 */
export function mesesFuturos(anio: number, meses: number[], hoy: Date = new Date()): number[] {
  const actual = anioMesColombia(hoy);
  if (anio > actual.anio) return meses.length ? [...meses] : [1];
  if (anio < actual.anio) return [];
  return meses.filter((m) => m > actual.mes);
}

/** Meses sin repetir y en orden; vacío = todo el año. */
export function normalizarMeses(meses: number[] | undefined): number[] {
  return [...new Set(meses ?? [])].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
}

/**
 * Rangos de fechas del periodo, en hora de Colombia (con rangoPeriodo y rangoDias de formato.ts):
 *  - instantes [inicio, fin) para las facturas (creadoEn);
 *  - días [desde, hasta) para los gastos (fecha del gasto, sin hora).
 * Un rango por cada mes elegido (los meses no tienen que ser seguidos). Sin meses = el año completo.
 */
export function rangosDelPeriodo(anio: number, meses: number[]) {
  const lista = normalizarMeses(meses);
  if (lista.length === 0) return { instantes: [rangoPeriodo(anio)], dias: [rangoDias(anio)] };
  return { instantes: lista.map((m) => rangoPeriodo(anio, m)), dias: lista.map((m) => rangoDias(anio, m)) };
}

/** "Marzo y Abril de 2026" · "Todo el año 2026". */
export function describirPeriodo(anio: number, meses: number[]): string {
  const lista = normalizarMeses(meses);
  if (lista.length === 0 || lista.length === 12) return `Todo el año ${anio}`;
  const nombres = lista.map((m) => MESES[m - 1]);
  const texto = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  return `${texto} de ${anio}`;
}

/* ----------------------------- Confirmación ----------------------------- */

/** Texto que la persona debe escribir: "BORRAR Local Centro". */
export const textoConfirmacion = (nombreLocal: string) => `BORRAR ${nombreLocal}`;

/** Sin importar mayúsculas ni espacios de más (al inicio, al final o repetidos). */
const comparable = (texto: string) => texto.replace(/\s+/g, " ").trim().toLocaleUpperCase("es");

/** ¿Lo escrito coincide con "BORRAR <NOMBRE DEL LOCAL>"? */
export function confirmacionCoincide(escrito: string, nombreLocal: string): boolean {
  return comparable(escrito) === comparable(textoConfirmacion(nombreLocal));
}

/* -------------------------------- Conteos -------------------------------- */

/** Lo que una limpieza borra (o borraría) y lo que conserva. Lo devuelven la vista previa y la ejecución. */
export interface ConteosLimpieza {
  ventas: { cantidad: number; valor: number; anuladas: number };
  itemsVenta: number;
  creditos: { cantidad: number; valor: number; conSaldo: number; saldo: number };
  cuotas: number;
  abonos: { cantidad: number; valor: number };
  gastos: { cantidad: number; valor: number; eliminados: number };
  clientes: { cantidad: number; conservados: number };
  productos: { cantidad: number; movimientos: number };
  /** Lo que se CONSERVA aunque sea del periodo (para dejarlo claro en la vista previa). */
  conservados: { creditos: number; abonos: number };
}

/** ¿Hay algo que borrar? */
export function hayAlgoQueBorrar(c: ConteosLimpieza): boolean {
  return c.ventas.cantidad + c.creditos.cantidad + c.gastos.cantidad + c.clientes.cantidad + c.productos.cantidad > 0;
}

/** "3 ventas, 2 gastos y 5 clientes" (solo lo que tiene registros). */
export function describirConteos(c: ConteosLimpieza): string {
  const partes = [
    [c.ventas.cantidad, "venta", "ventas"],
    [c.creditos.cantidad, "crédito", "créditos"],
    [c.gastos.cantidad, "gasto", "gastos"],
    [c.clientes.cantidad, "cliente", "clientes"],
    [c.productos.cantidad, "producto", "productos"],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
  if (partes.length === 0) return "nada";
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
