/**
 * Servicio de inventario de productos (cada local tiene su propio inventario).
 */
import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { facturaItems, marcas, productos } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { Genero, Publico, Tamano, TipoProducto } from "@/lib/clasificacion";
import { escaparLike, normalizarTexto } from "@/lib/formato";
import type { Producto } from "@/tipos";
import { validarMarcaDelLocal } from "./marcas";

interface DatosProducto {
  nombre: string;
  codigo: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  marcaId: string;
  tipo: TipoProducto;
  genero: Genero;
  publico: Publico;
  tamano: Tamano;
}

/** Columnas que se guardan igual al crear y al editar. */
function columnas(datos: DatosProducto) {
  return {
    nombre: datos.nombre,
    nombreBusqueda: normalizarTexto(datos.nombre),
    codigo: datos.codigo || null,
    precio: datos.precio,
    stock: datos.stock,
    stockMinimo: datos.stockMinimo,
    marcaId: datos.marcaId,
    tipo: datos.tipo,
    genero: datos.genero,
    publico: datos.publico,
    tamano: datos.tamano,
  };
}

/**
 * Búsqueda inteligente:
 *  - No distingue mayúsculas, tildes, ñ ni signos ("agua de rosa" encuentra "Agua-de.Rosa").
 *  - Cada palabra escrita debe aparecer en el nombre, en cualquier orden.
 *  - También busca por código exacto o parcial.
 *  - Muestra primero los productos que tienen stock.
 */
function condicionBusqueda(texto: string): SQL | undefined {
  const palabras = normalizarTexto(texto).split(" ").filter(Boolean);
  if (palabras.length === 0) return undefined;
  const porNombre = and(...palabras.map((p) => ilike(productos.nombreBusqueda, `%${escaparLike(p)}%`)));
  const porCodigo = ilike(productos.codigo, `%${escaparLike(texto.trim())}%`);
  return or(porNombre, porCodigo);
}

/** Máximo de productos que se envían al navegador de una sola vez. */
const LIMITE_LISTA = 500;

export async function listarProductos(localId: string, texto?: string): Promise<{ productos: Producto[]; hayMas: boolean }> {
  const filas = await db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      codigo: productos.codigo,
      precio: productos.precio,
      stock: productos.stock,
      stockMinimo: productos.stockMinimo,
      marcaId: productos.marcaId,
      marcaNombre: marcas.nombre,
      tipo: productos.tipo,
      genero: productos.genero,
      publico: productos.publico,
      tamano: productos.tamano,
    })
    .from(productos)
    .leftJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(and(eq(productos.localId, localId), eq(productos.activo, true), texto ? condicionBusqueda(texto) : undefined))
    .orderBy(asc(productos.nombreBusqueda))
    .limit(LIMITE_LISTA + 1);
  // "hayMas" le avisa a la factura que debe buscar en el servidor en vez de filtrar en el navegador
  return { productos: filas.slice(0, LIMITE_LISTA), hayMas: filas.length > LIMITE_LISTA };
}

export async function buscarParaVenta(localId: string, texto: string) {
  const condicion = condicionBusqueda(texto);
  if (!condicion) return [];
  return db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      codigo: productos.codigo,
      precio: productos.precio,
      stock: productos.stock,
    })
    .from(productos)
    .where(and(eq(productos.localId, localId), eq(productos.activo, true), condicion))
    .orderBy(desc(sql`${productos.stock} > 0`), asc(productos.nombreBusqueda))
    .limit(12);
}

export async function crearProducto(localId: string, datos: DatosProducto) {
  await validarMarcaDelLocal(localId, datos.marcaId);
  const [producto] = await db
    .insert(productos)
    .values({ localId, ...columnas(datos) })
    .returning();
  return producto;
}

export async function editarProducto(localId: string, id: string, datos: DatosProducto) {
  const actual = await obtenerProducto(localId, id);
  await validarMarcaDelLocal(localId, datos.marcaId, actual.marcaId);
  await db.update(productos).set(columnas(datos)).where(eq(productos.id, id));
}

/** Suma (entrada de mercancía) o resta (salida/ajuste) unidades al stock. */
export async function ajustarStock(localId: string, id: string, cantidad: number) {
  const producto = await obtenerProducto(localId, id);
  if (producto.stock + cantidad < 0) {
    throw new ApiError(400, `No puedes restar ${Math.abs(cantidad)} unidades: solo hay ${producto.stock} en stock.`);
  }
  const [actualizado] = await db
    .update(productos)
    .set({ stock: sql`${productos.stock} + ${cantidad}` })
    .where(eq(productos.id, id))
    .returning();
  return actualizado;
}

/**
 * Elimina un producto. Si ya tiene ventas registradas, solo se oculta
 * (para no afectar el historial de facturas).
 */
export async function eliminarProducto(localId: string, id: string) {
  await obtenerProducto(localId, id);
  const vendido = await db.query.facturaItems.findFirst({ where: eq(facturaItems.productoId, id) });
  if (vendido) {
    await db.update(productos).set({ activo: false }).where(eq(productos.id, id));
  } else {
    await db.delete(productos).where(eq(productos.id, id));
  }
}

async function obtenerProducto(localId: string, id: string) {
  const producto = await db.query.productos.findFirst({
    where: and(eq(productos.id, id), eq(productos.localId, localId), eq(productos.activo, true)),
  });
  if (!producto) throw new ApiError(404, "El producto no existe en tu local.");
  return producto;
}
