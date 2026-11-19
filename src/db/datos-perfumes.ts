/**
 * Catálogo de EJEMPLO para probar la aplicación (lo usa `npm run db:seed-perfumes`).
 * Solo datos: no se conecta a la base de datos, así se puede probar con `npm test`.
 *
 * Cubre los 4 públicos (Hombre, Mujer, Niño, Niña), los 5 tipos y los 5 contenidos (60 a 125 ml).
 * Stock: 3 agotados y 4 en stock bajo (stock ≤ mínimo) para ver alertas y notificaciones.
 */
import type { Genero, Publico, TipoProducto } from "../lib/clasificacion";

/** Contenidos (ml) del catálogo de ejemplo, de menor a mayor. */
export const MILILITROS_EJEMPLO = [60, 75, 100, 120, 125] as const;
export type MlEjemplo = (typeof MILILITROS_EJEMPLO)[number];

export const MARCAS_EJEMPLO = [
  // Diseñador
  "Dior",
  "Chanel",
  "Carolina Herrera",
  "Paco Rabanne",
  // Árabes
  "Lattafa",
  "Armaf",
  "Rasasi",
  "Afnan",
] as const;

export type MarcaEjemplo = (typeof MARCAS_EJEMPLO)[number];

/** Stock mínimo de todos los productos de ejemplo (el mismo valor por defecto de la app). */
export const STOCK_MINIMO_EJEMPLO = 3;

/**
 * Precio en pesos COP (entero) según tipo y contenido (ml).
 * El precio más barato de un tipo siempre supera al más caro del tipo siguiente:
 * Original > 1.1 > Versión / Imitación > Esencia.
 */
export const PRECIOS_EJEMPLO: Record<TipoProducto, Record<MlEjemplo, number>> = {
  ORIGINAL: { 60: 380_000, 75: 420_000, 100: 520_000, 120: 590_000, 125: 650_000 },
  UNO_UNO: { 60: 150_000, 75: 165_000, 100: 190_000, 120: 215_000, 125: 230_000 },
  VERSION: { 60: 75_000, 75: 85_000, 100: 100_000, 120: 112_000, 125: 120_000 },
  IMITACION: { 60: 60_000, 75: 68_000, 100: 80_000, 120: 90_000, 125: 98_000 },
  ESENCIA: { 60: 25_000, 75: 29_000, 100: 35_000, 120: 40_000, 125: 45_000 },
};

export interface PerfumeEjemplo {
  /** Código fijo: es lo que evita duplicados si el seed se corre otra vez. */
  codigo: string;
  nombre: string;
  marca: MarcaEjemplo;
  tipo: TipoProducto;
  genero: Genero;
  publico: Publico;
  contenidoMl: MlEjemplo;
  stock: number;
}

type Fila = [codigo: string, nombre: string, marca: MarcaEjemplo, tipo: TipoProducto, genero: Genero, publico: Publico, contenidoMl: MlEjemplo, stock: number];

const FILAS: Fila[] = [
  // Hombre adulto
  ["DEMO-01", "Dior Sauvage EDT", "Dior", "ORIGINAL", "HOMBRE", "ADULTO", 100, 8],
  ["DEMO-02", "Bleu de Chanel EDP", "Chanel", "ORIGINAL", "HOMBRE", "ADULTO", 100, 0], // agotado
  ["DEMO-03", "Paco Rabanne 1 Million", "Paco Rabanne", "UNO_UNO", "HOMBRE", "ADULTO", 100, 12],
  ["DEMO-04", "Carolina Herrera 212 VIP Men", "Carolina Herrera", "UNO_UNO", "HOMBRE", "ADULTO", 120, 2], // stock bajo
  ["DEMO-05", "Lattafa Asad", "Lattafa", "ORIGINAL", "HOMBRE", "ADULTO", 100, 10],
  ["DEMO-06", "Armaf Club de Nuit Intense", "Armaf", "VERSION", "HOMBRE", "ADULTO", 100, 15],
  ["DEMO-07", "Rasasi Hawas", "Rasasi", "IMITACION", "HOMBRE", "ADULTO", 120, 7],
  ["DEMO-08", "Afnan 9PM", "Afnan", "ESENCIA", "HOMBRE", "ADULTO", 60, 20],
  ["DEMO-09", "Paco Rabanne Invictus", "Paco Rabanne", "VERSION", "HOMBRE", "ADULTO", 125, 1], // stock bajo
  // Mujer adulta
  ["DEMO-10", "Carolina Herrera Good Girl", "Carolina Herrera", "ORIGINAL", "MUJER", "ADULTO", 75, 6],
  ["DEMO-11", "Chanel Coco Mademoiselle", "Chanel", "ORIGINAL", "MUJER", "ADULTO", 100, 9],
  ["DEMO-12", "Dior J'adore", "Dior", "UNO_UNO", "MUJER", "ADULTO", 100, 11],
  ["DEMO-13", "Lattafa Yara", "Lattafa", "ORIGINAL", "MUJER", "ADULTO", 100, 14],
  ["DEMO-14", "Paco Rabanne Olympéa", "Paco Rabanne", "IMITACION", "MUJER", "ADULTO", 75, 0], // agotado
  ["DEMO-15", "Armaf Club de Nuit Woman", "Armaf", "VERSION", "MUJER", "ADULTO", 100, 13],
  ["DEMO-16", "Rasasi La Yuqawam Femme", "Rasasi", "UNO_UNO", "MUJER", "ADULTO", 125, 6],
  ["DEMO-17", "Afnan Supremacy Pink", "Afnan", "ESENCIA", "MUJER", "ADULTO", 75, 18],
  ["DEMO-18", "Carolina Herrera 212 Sexy", "Carolina Herrera", "ESENCIA", "MUJER", "ADULTO", 125, 2], // stock bajo
  // Niño
  ["DEMO-19", "Dior Petit Explorador", "Dior", "IMITACION", "HOMBRE", "INFANTIL", 60, 9],
  ["DEMO-20", "Paco Rabanne Mini Aventura", "Paco Rabanne", "VERSION", "HOMBRE", "INFANTIL", 60, 16],
  ["DEMO-21", "Lattafa Pequeño León", "Lattafa", "ESENCIA", "HOMBRE", "INFANTIL", 60, 22],
  ["DEMO-22", "Armaf Junior Azul", "Armaf", "UNO_UNO", "HOMBRE", "INFANTIL", 75, 0], // agotado
  ["DEMO-23", "Chanel Petit Sport", "Chanel", "ORIGINAL", "HOMBRE", "INFANTIL", 60, 7],
  ["DEMO-24", "Afnan Kids Fresh", "Afnan", "IMITACION", "HOMBRE", "INFANTIL", 100, 10],
  // Niña
  ["DEMO-25", "Carolina Herrera Mini Princesa", "Carolina Herrera", "IMITACION", "MUJER", "INFANTIL", 60, 8],
  ["DEMO-26", "Dior Petite Rosé", "Dior", "VERSION", "MUJER", "INFANTIL", 75, 1], // stock bajo
  ["DEMO-27", "Rasasi Flor de Niña", "Rasasi", "ESENCIA", "MUJER", "INFANTIL", 60, 25],
  ["DEMO-28", "Lattafa Yara Kids", "Lattafa", "UNO_UNO", "MUJER", "INFANTIL", 60, 12],
  ["DEMO-29", "Chanel Petite Fleur", "Chanel", "ORIGINAL", "MUJER", "INFANTIL", 75, 6],
  ["DEMO-30", "Afnan Dulce Niña", "Afnan", "VERSION", "MUJER", "INFANTIL", 120, 9],
];

export const PERFUMES_EJEMPLO: PerfumeEjemplo[] = FILAS.map(([codigo, nombre, marca, tipo, genero, publico, contenidoMl, stock]) => ({
  codigo,
  nombre,
  marca,
  tipo,
  genero,
  publico,
  contenidoMl,
  stock,
}));

/** Precio de venta de un perfume de ejemplo. */
export function precioEjemplo(p: Pick<PerfumeEjemplo, "tipo" | "contenidoMl">): number {
  return PRECIOS_EJEMPLO[p.tipo][p.contenidoMl];
}
