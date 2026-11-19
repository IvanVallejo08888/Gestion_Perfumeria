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

/**
 * Onzas con las que se venden comercialmente los tamaños más comunes (como dicen las etiquetas):
 * 120 ml se vende como "4 oz" aunque la cuenta exacta dé 4.1. Las esencias de 40 ml se venden como "1 oz".
 */
const ONZAS_COMERCIALES: Record<number, string> = {
  30: "1", 40: "1", 47: "1.6", 50: "1.7", 60: "2", 65: "2.2", 75: "2.5", 80: "2.7", 90: "3",
  100: "3.4", 120: "4", 125: "4.2", 150: "5", 200: "6.8", 250: "8.4",
};

/** Equivalente en onzas: 100 → "3.4 oz". Si no es un tamaño común, se calcula (1 oz = 29,5735 ml) con un decimal. */
export function textoOz(ml: number): string {
  const oz = ONZAS_COMERCIALES[ml] ?? String(Math.round((ml / 29.5735) * 10) / 10);
  return `${oz} oz`;
}

/** Contenido en ml con su equivalente en onzas: 100 → "100 ml (3.4 oz)". */
export const textoMlConOz = (ml: number) => `${textoMl(ml)} (${textoOz(ml)})`;

/** Tamaños del selector del formulario, agrupados (<optgroup>) para encontrarlos rápido. Se puede escribir otro. */
export const GRUPOS_MILILITROS: { titulo: string; mililitros: readonly number[] }[] = [
  { titulo: "Frascos pequeños (10–50 ml)", mililitros: [10, 30, 40, 47, 50] },
  { titulo: "Frascos (60–150 ml)", mililitros: [60, 65, 75, 80, 90, 100, 120, 125, 150] },
  { titulo: "Cremas y splash (200–250 ml)", mililitros: [200, 250] },
];

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

/** Categorías que se ofrecen al agregar un producto (Body Mist, Desodorante, Decant y Accesorio, de momento no). */
export const CATEGORIAS_FORMULARIO = ["PERFUME", "ESTUCHE", "CREMA", "OTRO"] as const satisfies readonly Categoria[];

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
