/**
 * Reglas del dashboard de reportes compartidas por el servidor, el Excel y las pantallas.
 * Son funciones puras (sin base de datos) para poder probarlas con `npm test`.
 *
 * Un "corte" es una forma de repartir las ventas: por público, tipo, marca o tamaño.
 * Las ventas sin clasificación (facturas anteriores) se agrupan como "Sin categoría".
 */
import {
  ETIQUETA_TAMANO,
  ETIQUETA_TIPO,
  etiquetaPara,
  GENEROS,
  PUBLICOS,
  SIN_CATEGORIA,
  TAMANOS,
  TIPOS_PRODUCTO,
  type Genero,
  type Publico,
} from "./clasificacion";

/** Una barra de una gráfica de ventas. */
export interface CorteVenta {
  clave: string;
  etiqueta: string;
  unidades: number;
  valor: number;
}

/** Fila tal como sale del GROUP BY (clave null = sin clasificación). */
export interface FilaCorte {
  clave: string | null;
  etiqueta?: string | null;
  unidades: number;
  valor: number;
}

export const CLAVE_SIN_CATEGORIA = "SIN_CATEGORIA";
export const CLAVE_OTRAS = "OTRAS";

/* ----------------------- Público: Hombre / Niño / Mujer / Niña ----------------------- */

/** Clave "HOMBRE_ADULTO"… igual a la que arma el SQL (genero || '_' || publico). */
export const clavePublico = (genero: Genero, publico: Publico) => `${genero}_${publico}`;

/** Orden fijo: Hombre, Niño, Mujer, Niña. */
export const CORTES_PUBLICO: { clave: string; etiqueta: string }[] = GENEROS.flatMap((genero) =>
  PUBLICOS.map((publico) => ({ clave: clavePublico(genero, publico), etiqueta: etiquetaPara(genero, publico) })),
);
export const CORTES_TIPO = TIPOS_PRODUCTO.map((clave) => ({ clave: clave as string, etiqueta: ETIQUETA_TIPO[clave] }));
export const CORTES_TAMANO = TAMANOS.map((clave) => ({ clave: clave as string, etiqueta: ETIQUETA_TAMANO[clave] }));

/**
 * Categorías de lista fija (público, tipo, tamaño): siempre salen todas y en el mismo orden,
 * con cero las que no tuvieron ventas. "Sin categoría" va al final y solo si tiene datos.
 */
export function completarCortes(orden: { clave: string; etiqueta: string }[], filas: FilaCorte[]): CorteVenta[] {
  const porClave = new Map(filas.map((f) => [f.clave ?? CLAVE_SIN_CATEGORIA, f]));
  const cortes: CorteVenta[] = orden.map(({ clave, etiqueta }) => ({
    clave,
    etiqueta,
    unidades: porClave.get(clave)?.unidades ?? 0,
    valor: porClave.get(clave)?.valor ?? 0,
  }));
  const sin = porClave.get(CLAVE_SIN_CATEGORIA);
  if (sin && (sin.unidades > 0 || sin.valor > 0)) {
    cortes.push({ clave: CLAVE_SIN_CATEGORIA, etiqueta: SIN_CATEGORIA, unidades: sin.unidades, valor: sin.valor });
  }
  return cortes;
}

/** Categorías abiertas (marcas): de mayor a menor valor, con "Sin categoría" al final. */
export function ordenarCortes(filas: FilaCorte[]): CorteVenta[] {
  const cortes = filas
    .filter((f) => f.clave !== null)
    .map((f) => ({ clave: f.clave as string, etiqueta: f.etiqueta ?? (f.clave as string), unidades: f.unidades, valor: f.valor }))
    .sort((a, b) => b.valor - a.valor || b.unidades - a.unidades || a.etiqueta.localeCompare(b.etiqueta, "es"));
  const sin = filas.find((f) => f.clave === null);
  if (sin && (sin.unidades > 0 || sin.valor > 0)) {
    cortes.push({ clave: CLAVE_SIN_CATEGORIA, etiqueta: SIN_CATEGORIA, unidades: sin.unidades, valor: sin.valor });
  }
  return cortes;
}

/**
 * Deja las primeras `limite` categorías y suma el resto en "Otras".
 * "Sin categoría" no cuenta para el límite ni entra en "Otras": se conserva al final.
 * Recibe la lista ya ordenada (ver ordenarCortes).
 */
export function topConOtras(cortes: CorteVenta[], limite: number, etiquetaOtras = "Otras"): CorteVenta[] {
  const sin = cortes.filter((c) => c.clave === CLAVE_SIN_CATEGORIA);
  const reales = cortes.filter((c) => c.clave !== CLAVE_SIN_CATEGORIA);
  if (reales.length <= limite) return cortes;
  const resto = reales.slice(limite);
  return [
    ...reales.slice(0, limite),
    {
      clave: CLAVE_OTRAS,
      etiqueta: `${etiquetaOtras} (${resto.length})`,
      unidades: resto.reduce((a, c) => a + c.unidades, 0),
      valor: resto.reduce((a, c) => a + c.valor, 0),
    },
    ...sin,
  ];
}

/** ¿Hay algo que mostrar? (para el estado vacío de cada gráfica). */
export const hayDatos = (cortes: { unidades?: number; valor?: number }[]) => cortes.some((c) => (c.unidades ?? 0) > 0 || (c.valor ?? 0) > 0);

/** "$ 1,2 M" / "$ 350 mil" para los ejes y rótulos, donde el valor completo no cabe. */
export function pesosCorto(valor: number): string {
  const abs = Math.abs(valor);
  const signo = valor < 0 ? "−" : "";
  const decimal = (n: number) => n.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (abs >= 1_000_000) return `${signo}$ ${decimal(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${signo}$ ${Math.round(abs / 1_000)} mil`;
  return `${signo}$ ${abs}`;
}
