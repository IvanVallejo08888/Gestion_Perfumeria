/**
 * Clasificación de los perfumes: tipo, género, público y tamaño.
 * Estas listas son la ÚNICA fuente: las usan el esquema de la base de datos (enums),
 * las validaciones Zod y las pantallas. Se pueden usar en el servidor y en el navegador.
 */

export const TIPOS_PRODUCTO = ["ORIGINAL", "UNO_UNO", "IMITACION", "VERSION", "ESENCIA"] as const;
export const GENEROS = ["HOMBRE", "MUJER"] as const;
export const PUBLICOS = ["ADULTO", "INFANTIL"] as const;
/**
 * Tamaños permitidos. Se guardan como enum (no como número decimal):
 * la base de datos rechaza cualquier otro valor y no hay errores de redondeo.
 * El orden de la lista es de menor a mayor.
 */
export const TAMANOS = ["OZ_2", "OZ_2_5", "OZ_3_4", "OZ_4", "OZ_4_2"] as const;

export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];
export type Genero = (typeof GENEROS)[number];
export type Publico = (typeof PUBLICOS)[number];
export type Tamano = (typeof TAMANOS)[number];

export const ETIQUETA_TIPO: Record<TipoProducto, string> = {
  ORIGINAL: "Original",
  UNO_UNO: "1.1",
  IMITACION: "Imitación",
  VERSION: "Versión",
  ESENCIA: "Esencia",
};

export const ETIQUETA_GENERO: Record<Genero, string> = { HOMBRE: "Hombre", MUJER: "Mujer" };
export const ETIQUETA_PUBLICO: Record<Publico, string> = { ADULTO: "Adulto", INFANTIL: "Infantil" };

/** Mililitros con los que se venden comercialmente (1 oz ≈ 29,57 ml, redondeado como en las etiquetas). */
export const ETIQUETA_TAMANO: Record<Tamano, string> = {
  OZ_2: "2 oz (60 ml)",
  OZ_2_5: "2.5 oz (75 ml)",
  OZ_3_4: "3.4 oz (100 ml)",
  OZ_4: "4 oz (120 ml)",
  OZ_4_2: "4.2 oz (125 ml)",
};

export const SIN_CATEGORIA = "Sin categoría";

/** Hombre + Infantil = "Niño" · Mujer + Infantil = "Niña" · Adulto = "Hombre" / "Mujer". */
export function etiquetaPara(genero: Genero, publico: Publico): string {
  if (publico === "INFANTIL") return genero === "HOMBRE" ? "Niño" : "Niña";
  return ETIQUETA_GENERO[genero];
}

export interface Clasificacion {
  marcaNombre?: string | null;
  tipo?: TipoProducto | null;
  genero?: Genero | null;
  publico?: Publico | null;
  tamano?: Tamano | null;
}

/**
 * Texto corto con la clasificación: "Dior · Original · Hombre · 3.4 oz (100 ml)".
 * Si no tiene ningún dato (productos o facturas anteriores a la clasificación) → "Sin categoría".
 */
export function describirClasificacion(c: Clasificacion): string {
  const partes: string[] = [];
  if (c.marcaNombre) partes.push(c.marcaNombre);
  if (c.tipo) partes.push(ETIQUETA_TIPO[c.tipo]);
  if (c.genero && c.publico) partes.push(etiquetaPara(c.genero, c.publico));
  else if (c.genero) partes.push(ETIQUETA_GENERO[c.genero]);
  else if (c.publico) partes.push(ETIQUETA_PUBLICO[c.publico]);
  if (c.tamano) partes.push(ETIQUETA_TAMANO[c.tamano]);
  return partes.length ? partes.join(" · ") : SIN_CATEGORIA;
}

/** Lista de opciones { valor, texto } para botones y selectores. */
export function opcionesDe<T extends string>(lista: readonly T[], etiquetas: Record<T, string>): { valor: T; texto: string }[] {
  return lista.map((valor) => ({ valor, texto: etiquetas[valor] }));
}
