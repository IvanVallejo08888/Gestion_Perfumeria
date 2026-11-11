/**
 * Servicio de inventario de productos (cada local tiene su propio inventario).
 * Todo cambio de stock deja un movimiento (ver movimientos.ts):
 *  crear con unidades → INGRESO "Stock inicial" · agregar unidades → INGRESO · ajuste → AJUSTE · factura → VENTA.
 * Editar un producto NO cambia su stock.
 */
import "server-only";
import { and, asc, desc, eq, gt, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { facturaItems, marcas, productos } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { Genero, Publico, Tamano, TipoProducto } from "@/lib/clasificacion";
import { escaparLike, normalizarTexto } from "@/lib/formato";
import type { EstadoStock, FiltrosInventario } from "@/lib/inventario";
import type { Producto, ProductoVenta } from "@/tipos";
import { validarMarcaDelLocal } from "./marcas";
import { registrarMovimientos, type Autor } from "./movimientos";

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

/** Columnas que se guardan igual al crear y al editar (el stock solo cambia con movimientos). */
function columnas(datos: DatosProducto) {
  return {
    nombre: datos.nombre,
    nombreBusqueda: normalizarTexto(datos.nombre),
    codigo: datos.codigo || null,
    precio: datos.precio,
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

/** Misma regla de estadoStock() en src/lib/inventario.ts y de las notificaciones. */
function condicionStock(estado: EstadoStock): SQL | undefined {
  if (estado === "AGOTADO") return lte(productos.stock, 0);
  if (estado === "BAJO") return and(gt(productos.stock, 0), lte(productos.stock, productos.stockMinimo));
  return gt(productos.stock, productos.stockMinimo);
}

/**
 * Inventario del local con filtros combinables. Sin filtros devuelve todo
 * (así lo usa también la lista de productos de Facturación).
 */
export async function listarProductos(localId: string, filtros: FiltrosInventario = {}): Promise<{ productos: Producto[]; hayMas: boolean }> {
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
    .where(
      and(
        eq(productos.localId, localId),
        eq(productos.activo, true),
        filtros.q ? condicionBusqueda(filtros.q) : undefined,
        filtros.genero ? eq(productos.genero, filtros.genero) : undefined,
        filtros.publico ? eq(productos.publico, filtros.publico) : undefined,
        filtros.marcaId ? eq(productos.marcaId, filtros.marcaId) : undefined,
        filtros.tipo ? eq(productos.tipo, filtros.tipo) : undefined,
        filtros.tamano ? eq(productos.tamano, filtros.tamano) : undefined,
        filtros.stock ? condicionStock(filtros.stock) : undefined,
      ),
    )
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

/** Un producto para cargarlo en la factura ("Vender" desde el inventario). */
export async function obtenerProductoVenta(localId: string, id: string): Promise<ProductoVenta> {
  const { nombre, codigo, precio, stock } = await obtenerProducto(localId, id);
  return { id, nombre, codigo, precio, stock };
}

export async function crearProducto(localId: string, datos: DatosProducto, autor: Autor) {
  await validarMarcaDelLocal(localId, datos.marcaId);
  return db.transaction(async (tx) => {
    const [producto] = await tx
      .insert(productos)
      .values({ localId, ...columnas(datos), stock: datos.stock })
      .returning();
    if (datos.stock > 0) {
      await registrarMovimientos(tx, [
        { localId, productoId: producto.id, tipo: "INGRESO", cantidad: datos.stock, stockResultante: datos.stock, autor, nota: "Stock inicial" },
      ]);
    }
    return producto;
  });
}

export async function editarProducto(localId: string, id: string, datos: DatosProducto) {
  const actual = await obtenerProducto(localId, id);
  await validarMarcaDelLocal(localId, datos.marcaId, actual.marcaId);
  await db.update(productos).set(columnas(datos)).where(eq(productos.id, id));
}

/**
 * Cambia el stock y registra el movimiento en una sola transacción.
 * El update es condicional (stock + cantidad >= 0): dos cambios al mismo tiempo nunca dejan stock negativo.
 */
async function moverStock(
  localId: string,
  id: string,
  movimiento: { tipo: "INGRESO" | "AJUSTE"; cantidad: number; nota?: string },
  autor: Autor,
) {
  return db.transaction(async (tx) => {
    const [actualizado] = await tx
      .update(productos)
      .set({ stock: sql`${productos.stock} + ${movimiento.cantidad}` })
      .where(
        and(
          eq(productos.id, id),
          eq(productos.localId, localId),
          eq(productos.activo, true),
          sql`${productos.stock} + ${movimiento.cantidad} >= 0`,
        ),
      )
      .returning({ id: productos.id, nombre: productos.nombre, stock: productos.stock });

    if (!actualizado) {
      const producto = await obtenerProducto(localId, id); // 404 si no existe
      throw new ApiError(400, `No puedes restar ${Math.abs(movimiento.cantidad)} unidades: solo hay ${producto.stock} en stock.`);
    }
    await registrarMovimientos(tx, [
      { localId, productoId: id, tipo: movimiento.tipo, cantidad: movimiento.cantidad, stockResultante: actualizado.stock, autor, nota: movimiento.nota },
    ]);
    return actualizado;
  });
}

/** Llegó mercancía: suma unidades (INGRESO). */
export function agregarUnidades(localId: string, id: string, datos: { cantidad: number; nota?: string }, autor: Autor) {
  return moverStock(localId, id, { tipo: "INGRESO", cantidad: datos.cantidad, nota: datos.nota }, autor);
}

/** Corrección manual (daño, conteo…): suma o resta y SIEMPRE lleva el motivo (AJUSTE). */
export function ajustarStock(localId: string, id: string, datos: { cantidad: number; nota: string }, autor: Autor) {
  return moverStock(localId, id, { tipo: "AJUSTE", cantidad: datos.cantidad, nota: datos.nota }, autor);
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
