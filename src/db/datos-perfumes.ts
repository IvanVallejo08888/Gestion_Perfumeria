/**
 * Catálogo de EJEMPLO para probar la aplicación (lo usa `npm run db:seed-perfumes`).
 * Solo datos: no se conecta a la base de datos, así se puede probar con `npm test`.
 *
 * Cubre los 4 públicos (Hombre, Mujer, Niño, Niña), los 5 tipos y los 5 tamaños.
 * Stock: 3 agotados y 4 en stock bajo (stock ≤ mínimo) para ver alertas y notificaciones.
 */
import type { Genero, Publico, Tamano, TipoProducto } from "../lib/clasificacion";

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
 * Precio en pesos COP (entero) según tipo y tamaño.
 * El precio más barato de un tipo siempre supera al más caro del tipo siguiente:
 * Original > 1.1 > Versión / Imitación > Esencia.
 */
export const PRECIOS_EJEMPLO: Record<TipoProducto, Record<Tamano, number>> = {
  ORIGINAL: { OZ_2: 380_000, OZ_2_5: 420_000, OZ_3_4: 520_000, OZ_4: 590_000, OZ_4_2: 650_000 },
  UNO_UNO: { OZ_2: 150_000, OZ_2_5: 165_000, OZ_3_4: 190_000, OZ_4: 215_000, OZ_4_2: 230_000 },
  VERSION: { OZ_2: 75_000, OZ_2_5: 85_000, OZ_3_4: 100_000, OZ_4: 112_000, OZ_4_2: 120_000 },
  IMITACION: { OZ_2: 60_000, OZ_2_5: 68_000, OZ_3_4: 80_000, OZ_4: 90_000, OZ_4_2: 98_000 },
  ESENCIA: { OZ_2: 25_000, OZ_2_5: 29_000, OZ_3_4: 35_000, OZ_4: 40_000, OZ_4_2: 45_000 },
};

export interface PerfumeEjemplo {
  /** Código fijo: es lo que evita duplicados si el seed se corre otra vez. */
  codigo: string;
  nombre: string;
  marca: MarcaEjemplo;
  tipo: TipoProducto;
  genero: Genero;
  publico: Publico;
  tamano: Tamano;
  stock: number;
}

type Fila = [codigo: string, nombre: string, marca: MarcaEjemplo, tipo: TipoProducto, genero: Genero, publico: Publico, tamano: Tamano, stock: number];

const FILAS: Fila[] = [
  // Hombre adulto
  ["DEMO-01", "Dior Sauvage EDT", "Dior", "ORIGINAL", "HOMBRE", "ADULTO", "OZ_3_4", 8],
  ["DEMO-02", "Bleu de Chanel EDP", "Chanel", "ORIGINAL", "HOMBRE", "ADULTO", "OZ_3_4", 0], // agotado
  ["DEMO-03", "Paco Rabanne 1 Million", "Paco Rabanne", "UNO_UNO", "HOMBRE", "ADULTO", "OZ_3_4", 12],
  ["DEMO-04", "Carolina Herrera 212 VIP Men", "Carolina Herrera", "UNO_UNO", "HOMBRE", "ADULTO", "OZ_4", 2], // stock bajo
  ["DEMO-05", "Lattafa Asad", "Lattafa", "ORIGINAL", "HOMBRE", "ADULTO", "OZ_3_4", 10],
  ["DEMO-06", "Armaf Club de Nuit Intense", "Armaf", "VERSION", "HOMBRE", "ADULTO", "OZ_3_4", 15],
  ["DEMO-07", "Rasasi Hawas", "Rasasi", "IMITACION", "HOMBRE", "ADULTO", "OZ_4", 7],
  ["DEMO-08", "Afnan 9PM", "Afnan", "ESENCIA", "HOMBRE", "ADULTO", "OZ_2", 20],
  ["DEMO-09", "Paco Rabanne Invictus", "Paco Rabanne", "VERSION", "HOMBRE", "ADULTO", "OZ_4_2", 1], // stock bajo
  // Mujer adulta
  ["DEMO-10", "Carolina Herrera Good Girl", "Carolina Herrera", "ORIGINAL", "MUJER", "ADULTO", "OZ_2_5", 6],
  ["DEMO-11", "Chanel Coco Mademoiselle", "Chanel", "ORIGINAL", "MUJER", "ADULTO", "OZ_3_4", 9],
  ["DEMO-12", "Dior J'adore", "Dior", "UNO_UNO", "MUJER", "ADULTO", "OZ_3_4", 11],
  ["DEMO-13", "Lattafa Yara", "Lattafa", "ORIGINAL", "MUJER", "ADULTO", "OZ_3_4", 14],
  ["DEMO-14", "Paco Rabanne Olympéa", "Paco Rabanne", "IMITACION", "MUJER", "ADULTO", "OZ_2_5", 0], // agotado
  ["DEMO-15", "Armaf Club de Nuit Woman", "Armaf", "VERSION", "MUJER", "ADULTO", "OZ_3_4", 13],
  ["DEMO-16", "Rasasi La Yuqawam Femme", "Rasasi", "UNO_UNO", "MUJER", "ADULTO", "OZ_4_2", 6],
  ["DEMO-17", "Afnan Supremacy Pink", "Afnan", "ESENCIA", "MUJER", "ADULTO", "OZ_2_5", 18],
  ["DEMO-18", "Carolina Herrera 212 Sexy", "Carolina Herrera", "ESENCIA", "MUJER", "ADULTO", "OZ_4_2", 2], // stock bajo
  // Niño
  ["DEMO-19", "Dior Petit Explorador", "Dior", "IMITACION", "HOMBRE", "INFANTIL", "OZ_2", 9],
  ["DEMO-20", "Paco Rabanne Mini Aventura", "Paco Rabanne", "VERSION", "HOMBRE", "INFANTIL", "OZ_2", 16],
  ["DEMO-21", "Lattafa Pequeño León", "Lattafa", "ESENCIA", "HOMBRE", "INFANTIL", "OZ_2", 22],
  ["DEMO-22", "Armaf Junior Azul", "Armaf", "UNO_UNO", "HOMBRE", "INFANTIL", "OZ_2_5", 0], // agotado
  ["DEMO-23", "Chanel Petit Sport", "Chanel", "ORIGINAL", "HOMBRE", "INFANTIL", "OZ_2", 7],
  ["DEMO-24", "Afnan Kids Fresh", "Afnan", "IMITACION", "HOMBRE", "INFANTIL", "OZ_3_4", 10],
  // Niña
  ["DEMO-25", "Carolina Herrera Mini Princesa", "Carolina Herrera", "IMITACION", "MUJER", "INFANTIL", "OZ_2", 8],
  ["DEMO-26", "Dior Petite Rosé", "Dior", "VERSION", "MUJER", "INFANTIL", "OZ_2_5", 1], // stock bajo
  ["DEMO-27", "Rasasi Flor de Niña", "Rasasi", "ESENCIA", "MUJER", "INFANTIL", "OZ_2", 25],
  ["DEMO-28", "Lattafa Yara Kids", "Lattafa", "UNO_UNO", "MUJER", "INFANTIL", "OZ_2", 12],
  ["DEMO-29", "Chanel Petite Fleur", "Chanel", "ORIGINAL", "MUJER", "INFANTIL", "OZ_2_5", 6],
  ["DEMO-30", "Afnan Dulce Niña", "Afnan", "VERSION", "MUJER", "INFANTIL", "OZ_4", 9],
];

export const PERFUMES_EJEMPLO: PerfumeEjemplo[] = FILAS.map(([codigo, nombre, marca, tipo, genero, publico, tamano, stock]) => ({
  codigo,
  nombre,
  marca,
  tipo,
  genero,
  publico,
  tamano,
  stock,
}));

/** Precio de venta de un perfume de ejemplo. */
export function precioEjemplo(p: Pick<PerfumeEjemplo, "tipo" | "tamano">): number {
  return PRECIOS_EJEMPLO[p.tipo][p.tamano];
}
