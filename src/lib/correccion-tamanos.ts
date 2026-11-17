/**
 * Reglas para corregir el tamaño de productos que quedaron mal registrados.
 * Solo datos y lógica pura (sin base de datos): la usa `npm run db:corregir-tamanos`
 * y se prueba con `npm test`.
 */
import type { Tamano, TipoProducto } from "./clasificacion";
import { normalizarTexto } from "./formato";

interface Regla {
  /** Descripción para el reporte del script. */
  descripcion: string;
  tamano: Tamano;
  aplica: (nombre: string, tipo: TipoProducto | null) => boolean;
}

/**
 * El orden importa: gana la primera regla que aplique.
 * Esencias y cremas van primero porque una "Esencia Lady Million" es una esencia (40 ml),
 * no el perfume de 2.7 oz.
 */
export const REGLAS_TAMANO: Regla[] = [
  {
    descripcion: "Esencias → 1 oz (40 ml)",
    tamano: "OZ_1_40ML",
    aplica: (n, tipo) => tipo === "ESENCIA" || n.startsWith("esencia"),
  },
  { descripcion: "Cremas → 200 ml", tamano: "OZ_6_8", aplica: (n) => /\bcrema/.test(n) },
  { descripcion: "Beluga → 30 ml", tamano: "OZ_1", aplica: (n) => n.includes("beluga") },
  { descripcion: "Aico → 1.6 oz", tamano: "OZ_1_6", aplica: (n) => /\baico\b/.test(n) },
  { descripcion: "Amore Mio → 1.7 oz", tamano: "OZ_1_7", aplica: (n) => n.includes("amore mio") },
  { descripcion: "Lady Million → 2.7 oz", tamano: "OZ_2_7", aplica: (n) => /lady mill?i?on/.test(n) },
  { descripcion: "Splash Lacoste → 250 ml", tamano: "OZ_8_4", aplica: (n) => n.includes("lacoste") && n.includes("splash") },
  {
    descripcion: "Omnia Coral original → 2.2 oz",
    tamano: "OZ_2_2",
    aplica: (n, tipo) => n.includes("omnia coral") && tipo === "ORIGINAL",
  },
];

/** Regla que corresponde al producto, o null si su tamaño no se debe tocar. */
export function reglaParaProducto(nombre: string, tipo: TipoProducto | null): Regla | null {
  const n = normalizarTexto(nombre);
  return REGLAS_TAMANO.find((r) => r.aplica(n, tipo)) ?? null;
}
