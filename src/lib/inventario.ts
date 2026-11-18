/**
 * Reglas del inventario compartidas por servidor, navegador y base de datos:
 *  - Tipos de movimiento (trazabilidad).
 *  - Estado del stock (disponible / bajo / agotado), la misma regla de las notificaciones.
 *  - Filtros de la pantalla de inventario, que se guardan en la URL.
 *
 * Sin imports con "@/": lo usa también src/db/schema.ts (drizzle-kit).
 */
import { GENEROS, PUBLICOS, TAMANOS, TIPOS_PRODUCTO, type Genero, type Publico, type Tamano, type TipoProducto } from "./clasificacion";

/* ------------------------------ Movimientos ------------------------------ */

export const TIPOS_MOVIMIENTO = ["INGRESO", "VENTA", "AJUSTE"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  INGRESO: "Ingreso",
  VENTA: "Venta",
  AJUSTE: "Ajuste",
};

/* --------------------------------- Stock --------------------------------- */

export const ESTADOS_STOCK = ["DISPONIBLE", "BAJO", "AGOTADO"] as const;
export type EstadoStock = (typeof ESTADOS_STOCK)[number];

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  DISPONIBLE: "Disponible",
  BAJO: "Stock bajo",
  AGOTADO: "Agotado",
};

/** Agotado = 0 · Bajo = entre 1 y el mínimo · Disponible = más que el mínimo. */
export function estadoStock(stock: number, stockMinimo: number): EstadoStock {
  if (stock <= 0) return "AGOTADO";
  if (stock <= stockMinimo) return "BAJO";
  return "DISPONIBLE";
}

/* -------------------------------- Filtros -------------------------------- */

export interface FiltrosInventario {
  q?: string;
  genero?: Genero;
  publico?: Publico;
  marcaId?: string;
  tipo?: TipoProducto;
  tamano?: Tamano;
  stock?: EstadoStock;
}

/** Orden fijo de los parámetros en la URL. */
const CLAVES = ["q", "genero", "publico", "marcaId", "tipo", "tamano", "stock"] as const;

const deLista = <T extends string>(lista: readonly T[], valor: string | null | undefined): T | undefined =>
  valor && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined;

/** Lee los filtros de la URL. Los valores que no existen se ignoran (sin errores para la persona). */
export function leerFiltros(parametros: { get(clave: string): string | null }): FiltrosInventario {
  const q = parametros.get("q")?.trim();
  const genero = deLista(GENEROS, parametros.get("genero"));
  return limpiarFiltros({
    q: q || undefined,
    genero,
    // El público solo tiene sentido dentro de una pestaña de género (Adulto/Niño, Adulta/Niña)
    publico: genero ? deLista(PUBLICOS, parametros.get("publico")) : undefined,
    marcaId: parametros.get("marcaId")?.trim() || undefined,
    tipo: deLista(TIPOS_PRODUCTO, parametros.get("tipo")),
    tamano: deLista(TAMANOS, parametros.get("tamano")),
    stock: deLista(ESTADOS_STOCK, parametros.get("stock")),
  });
}

function limpiarFiltros(f: FiltrosInventario): FiltrosInventario {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as FiltrosInventario;
}

/** "?genero=MUJER&tipo=ORIGINAL" (o "" si no hay filtros). */
export function filtrosAUrl(f: FiltrosInventario): string {
  const p = new URLSearchParams();
  for (const clave of CLAVES) {
    const valor = f[clave];
    if (valor) p.set(clave, valor);
  }
  const texto = p.toString();
  return texto ? `?${texto}` : "";
}

/** Filtros del panel (marca, tipo, tamaño y stock). La pestaña, los chips y el buscador se ven aparte. */
export function contarFiltros(f: FiltrosInventario): number {
  return [f.marcaId, f.tipo, f.tamano, f.stock].filter(Boolean).length;
}
