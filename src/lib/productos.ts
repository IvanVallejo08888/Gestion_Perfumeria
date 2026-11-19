/**
 * Nombre completo y texto de búsqueda de un producto.
 * Funciones puras (sin base de datos): las usan el servidor (al guardar), el navegador
 * (vista previa del formulario) y los scripts. Tienen pruebas en productos.test.ts.
 *
 * Sin imports con "@/": también los usan los scripts de src/db.
 */
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_CONCENTRACION,
  ETIQUETA_GENERO,
  ETIQUETA_TIPO,
  etiquetaPara,
  SIGLA_CONCENTRACION,
  type Categoria,
  type Concentracion,
  type Genero,
  type Publico,
  type TipoProducto,
} from "./clasificacion";
import { normalizarTexto } from "./formato";

export interface DatosNombreProducto {
  marca?: string | null;
  /** Nombre de la fragancia: "Aventus", "Sauvage", "Good Girl". */
  nombre: string;
  /** "Intense", "Blush", "Tester"… Si empieza por "+" (lo que trae un estuche) va al final: "100 ml + gel". */
  variante?: string | null;
  concentracion?: Concentracion | null;
  contenidoMl?: number | null;
  genero?: Genero | null;
  publico?: Publico | null;
  categoria?: Categoria | null;
}

/**
 * Categorías que se escriben al inicio del nombre porque cambian qué es el artículo:
 * "Estuche Dior Sauvage…", "Decant Creed Aventus…". Un perfume o un body mist no lo necesitan.
 */
const PREFIJO_CATEGORIA: Partial<Record<Categoria, string>> = {
  ESTUCHE: "Estuche",
  DECANT: "Decant",
  CREMA: "Crema",
  DESODORANTE: "Desodorante",
};

/** Quita espacios de más ("  Good   Girl " → "Good Girl"). */
const limpio = (texto: string | null | undefined) => (texto ?? "").replace(/\s+/g, " ").trim();

/** ¿El texto ya empieza por esas palabras? (sin importar tildes ni mayúsculas). */
const empiezaPor = (texto: string, inicio: string) => {
  const t = normalizarTexto(texto);
  const i = normalizarTexto(inicio);
  return i !== "" && (t === i || t.startsWith(`${i} `));
};

/** Género para el nombre: "Hombre", "Mujer", "Unisex"; con público infantil, "Niño" / "Niña". */
function textoGenero(genero?: Genero | null, publico?: Publico | null): string {
  if (!genero) return "";
  return publico ? etiquetaPara(genero, publico) : ETIQUETA_GENERO[genero];
}

/**
 * Nombre completo del producto, con el formato:
 *   «Marca Nombre Variante · Concentración Contenido ml · Género»
 * Ejemplos:
 *   "Creed Aventus · EDP 100 ml · Hombre"
 *   "Victoria's Secret Bombshell · Body Mist 250 ml"
 *   "Estuche Dior Sauvage · EDT 100 ml + gel"
 * Los campos vacíos no dejan espacios ni separadores sobrantes. Si el nombre ya trae la marca
 * ("Dior Sauvage" con marca "Dior"), la marca no se repite.
 */
export function armarNombreProducto(p: DatosNombreProducto): string {
  const nombre = limpio(p.nombre);
  const marca = limpio(p.marca);
  const variante = limpio(p.variante);
  const varianteAlFinal = variante.startsWith("+");

  // 1. Qué es: [categoría] Marca Nombre [Variante]
  const prefijo = p.categoria ? (PREFIJO_CATEGORIA[p.categoria] ?? "") : "";
  const conMarca = marca && !empiezaPor(nombre, marca) ? `${marca} ${nombre}` : nombre;
  // Si el nombre ya dice "Estuche" (en cualquier parte), no se repite al inicio
  const yaLoDice = prefijo !== "" && ` ${normalizarTexto(nombre)} `.includes(` ${normalizarTexto(prefijo)} `);
  const primero = [
    prefijo && !yaLoDice ? prefijo : "",
    conMarca,
    varianteAlFinal ? "" : variante,
  ]
    .filter(Boolean)
    .join(" ");

  // 2. Cómo es: Concentración Contenido ml [+ lo que trae el estuche]
  const segundo = [
    p.concentracion ? SIGLA_CONCENTRACION[p.concentracion] : "",
    p.contenidoMl ? `${p.contenidoMl} ml` : "",
    varianteAlFinal ? variante : "",
  ]
    .filter(Boolean)
    .join(" ");

  // 3. Para quién
  const tercero = textoGenero(p.genero, p.publico);

  return [primero, segundo, tercero].filter(Boolean).join(" · ");
}

export interface DatosBusquedaProducto extends DatosNombreProducto {
  codigo?: string | null;
  tipo?: TipoProducto | null;
}

/**
 * Texto en el que se busca (columna productos.nombre_busqueda), normalizado con normalizarTexto.
 * Lleva TODOS los datos, así se encuentra escribiendo en cualquier orden, sin tildes ni signos:
 * "aventus 100", "creed hombre", "edp 100ml", "100 ml dior", "sauvage edt", "eau de parfum"…
 * El contenido va como "100 ml" y "100ml" para que funcionen las dos formas de escribirlo.
 */
export function textoBusquedaProducto(p: DatosBusquedaProducto): string {
  const partes = [
    limpio(p.marca),
    limpio(p.nombre),
    limpio(p.variante),
    p.categoria ? ETIQUETA_CATEGORIA[p.categoria] : "",
    p.concentracion && p.concentracion !== "OTRO" ? `${p.concentracion} ${ETIQUETA_CONCENTRACION[p.concentracion]}` : "",
    p.contenidoMl ? `${p.contenidoMl} ml ${p.contenidoMl}ml` : "",
    textoGenero(p.genero, p.publico),
    p.genero ? ETIQUETA_GENERO[p.genero] : "",
    p.tipo ? ETIQUETA_TIPO[p.tipo] : "",
    limpio(p.codigo),
  ];
  // Sin palabras repetidas (por ejemplo "Hombre" del género y del público)
  return [...new Set(normalizarTexto(partes.join(" ")).split(" ").filter(Boolean))].join(" ");
}

/**
 * Clave para detectar un posible producto repetido: misma marca, nombre, variante,
 * concentración y contenido (sin importar mayúsculas, tildes ni espacios).
 */
export function claveDuplicado(p: Pick<DatosNombreProducto, "marca" | "nombre" | "variante" | "concentracion" | "contenidoMl">): string {
  return [normalizarTexto(p.marca ?? ""), normalizarTexto(p.nombre), normalizarTexto(p.variante ?? ""), p.concentracion ?? "", p.contenidoMl ?? ""].join("|");
}

/**
 * Parte el nombre completo en dos líneas para mostrarlo en espacios angostos (celular, factura):
 *   "Creed Aventus · EDP 100 ml · Hombre" → ["Creed Aventus", "EDP 100 ml · Hombre"]
 * Así se ve completo en 2 líneas, sin cortar datos. Un nombre simple (facturas antiguas) → [nombre, ""].
 */
export function partirNombre(nombreCompleto: string): [principal: string, detalle: string] {
  const [principal, ...resto] = nombreCompleto.split(" · ");
  return [principal, resto.join(" · ")];
}
