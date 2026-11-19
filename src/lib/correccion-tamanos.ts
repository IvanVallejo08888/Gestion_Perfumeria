/**
 * Reglas para corregir el contenido (ml) de productos que quedaron mal registrados.
 * Solo datos y lógica pura (sin base de datos): la usa `npm run db:corregir-tamanos`
 * y se prueba con `npm test`.
 */
import type { TipoProducto } from "./clasificacion";
import { normalizarTexto } from "./formato";

interface Regla {
  /** Descripción para el reporte del script. */
  descripcion: string;
  /** Contenido correcto en ml. */
  mililitros: number;
  aplica: (nombre: string, tipo: TipoProducto | null) => boolean;
}

/**
 * El orden importa: gana la primera regla que aplique.
 * Esencias y cremas van primero porque una "Esencia Lady Million" es una esencia (40 ml),
 * no el perfume de 80 ml.
 */
export const REGLAS_TAMANO: Regla[] = [
  {
    descripcion: "Esencias → 40 ml (1 oz)",
    mililitros: 40,
    aplica: (n, tipo) => tipo === "ESENCIA" || n.startsWith("esencia"),
  },
  { descripcion: "Cremas → 200 ml", mililitros: 200, aplica: (n) => /\bcrema/.test(n) },
  { descripcion: "Beluga → 30 ml", mililitros: 30, aplica: (n) => n.includes("beluga") },
  { descripcion: "Aico → 47 ml (1.6 oz)", mililitros: 47, aplica: (n) => /\baico\b/.test(n) },
  { descripcion: "Amore Mio → 50 ml (1.7 oz)", mililitros: 50, aplica: (n) => n.includes("amore mio") },
  { descripcion: "Lady Million → 80 ml (2.7 oz)", mililitros: 80, aplica: (n) => /lady mill?i?on/.test(n) },
  { descripcion: "Splash Lacoste → 250 ml", mililitros: 250, aplica: (n) => n.includes("lacoste") && n.includes("splash") },
  {
    descripcion: "Omnia Coral original → 65 ml (2.2 oz)",
    mililitros: 65,
    aplica: (n, tipo) => n.includes("omnia coral") && tipo === "ORIGINAL",
  },
];

/** Regla que corresponde al producto, o null si su contenido no se debe tocar. */
export function reglaParaProducto(nombre: string, tipo: TipoProducto | null): Regla | null {
  const n = normalizarTexto(nombre);
  return REGLAS_TAMANO.find((r) => r.aplica(n, tipo)) ?? null;
}
