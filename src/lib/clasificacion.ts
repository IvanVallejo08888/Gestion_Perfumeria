/**
 * Clasificación de los productos: tipo, género, público, concentración, categoría y contenido (ml).
 * Estas listas son la ÚNICA fuente: las usan el esquema de la base de datos (enums),
 * las validaciones Zod y las pantallas. Se pueden usar en el servidor y en el navegador.
 */

export const TIPOS_PRODUCTO = ["ORIGINAL", "UNO_UNO", "IMITACION", "VERSION", "ESENCIA"] as const;
export const GENEROS = ["HOMBRE", "MUJER", "UNISEX"] as const;
export const PUBLICOS = ["ADULTO", "INFANTIL"] as const;

export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];
export type Genero = (typeof GENEROS)[number];
export type Publico = (typeof PUBLICOS)[number];

export const ETIQUETA_TIPO: Record<TipoProducto, string> = {
  ORIGINAL: "Original",
  UNO_UNO: "1.1",
  IMITACION: "Imitación",
  VERSION: "Versión",
  ESENCIA: "Esencia",
};

export const ETIQUETA_GENERO: Record<Genero, string> = { HOMBRE: "Hombre", MUJER: "Mujer", UNISEX: "Unisex" };
export const ETIQUETA_PUBLICO: Record<Publico, string> = { ADULTO: "Adulto", INFANTIL: "Infantil" };

/** Contenido para mostrar: 100 → "100 ml". (Antes se guardaba en onzas; la migración 0005 lo pasó a ml.) */
export const textoMl = (ml: number) => `${ml} ml`;

export const SIN_CATEGORIA = "Sin categoría";

/* ------------------------- Concentración y categoría ------------------------- */

/** Concentración de la fragancia (de más a menos concentrada). */
export const CONCENTRACIONES = ["EXTRAIT", "PARFUM", "EDP", "EDT", "EDC", "BODY_MIST", "SPLASH", "OTRO"] as const;
export type Concentracion = (typeof CONCENTRACIONES)[number];

/** Nombre completo, para el selector del formulario. */
export const ETIQUETA_CONCENTRACION: Record<Concentracion, string> = {
  EXTRAIT: "Extrait de Parfum",
  PARFUM: "Parfum",
  EDP: "Eau de Parfum (EDP)",
  EDT: "Eau de Toilette (EDT)",
  EDC: "Eau de Cologne (EDC)",
  BODY_MIST: "Body Mist",
  SPLASH: "Splash",
  OTRO: "Otro",
};

/** Forma corta que va en el nombre del producto ("EDP 100 ml"). "Otro" no se escribe en el nombre. */
export const SIGLA_CONCENTRACION: Record<Concentracion, string> = {
  EXTRAIT: "Extrait de Parfum",
  PARFUM: "Parfum",
  EDP: "EDP",
  EDT: "EDT",
  EDC: "EDC",
  BODY_MIST: "Body Mist",
  SPLASH: "Splash",
  OTRO: "",
};

/** Qué clase de artículo es. */
export const CATEGORIAS = ["PERFUME", "ESTUCHE", "BODY_MIST", "CREMA", "DESODORANTE", "DECANT", "ACCESORIO", "OTRO"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  PERFUME: "Perfume",
  ESTUCHE: "Estuche / Set",
  BODY_MIST: "Body Mist",
  CREMA: "Crema",
  DESODORANTE: "Desodorante",
  DECANT: "Decant",
  ACCESORIO: "Accesorio",
  OTRO: "Otro",
};

/** Contenidos más comunes, para sugerirlos en el formulario (se puede escribir cualquier otro). */
export const MILILITROS_SUGERIDOS = [10, 30, 50, 60, 75, 80, 90, 100, 120, 125, 150, 200, 250] as const;

/** Hombre + Infantil = "Niño" · Mujer + Infantil = "Niña" · Unisex + Infantil = "Infantil unisex" · Adulto = el género. */
export function etiquetaPara(genero: Genero, publico: Publico): string {
  if (publico === "INFANTIL") return genero === "HOMBRE" ? "Niño" : genero === "MUJER" ? "Niña" : "Infantil unisex";
  return ETIQUETA_GENERO[genero];
}

export interface Clasificacion {
  marcaNombre?: string | null;
  tipo?: TipoProducto | null;
  genero?: Genero | null;
  publico?: Publico | null;
  contenidoMl?: number | null;
  concentracion?: Concentracion | null;
  categoria?: Categoria | null;
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
  if (c.concentracion && c.concentracion !== "OTRO") partes.push(SIGLA_CONCENTRACION[c.concentracion]);
  if (c.contenidoMl) partes.push(textoMl(c.contenidoMl));
  return partes.length ? partes.join(" · ") : SIN_CATEGORIA;
}

/** Lista de opciones { valor, texto } para botones y selectores. */
export function opcionesDe<T extends string>(lista: readonly T[], etiquetas: Record<T, string>): { valor: T; texto: string }[] {
  return lista.map((valor) => ({ valor, texto: etiquetas[valor] }));
}
