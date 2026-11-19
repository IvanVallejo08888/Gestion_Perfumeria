/**
 * Servicio de inventario de productos (cada local tiene su propio inventario).
 * Todo cambio de stock deja un movimiento (ver movimientos.ts):
 *  crear con unidades → INGRESO "Stock inicial" · agregar unidades → INGRESO · ajuste → AJUSTE · factura → VENTA.
 * Editar un producto NO cambia su stock.
 *
 * El nombre completo ("Creed Aventus · EDP 100 ml · Hombre") y el texto de búsqueda se calculan
 * SIEMPRE aquí, con armarNombreProducto() y textoBusquedaProducto() (src/lib/productos.ts).
 */
import "server-only";
import { and, asc, desc, eq, gt, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { facturaItems, marcas, productos } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { Categoria, Concentracion, Genero, Publico, TipoProducto } from "@/lib/clasificacion";
import { escaparLike, normalizarTexto } from "@/lib/formato";
import { armarNombreProducto, claveDuplicado, textoBusquedaProducto } from "@/lib/productos";
import type { EstadoStock, FiltrosInventario } from "@/lib/inventario";
import type { Producto, ProductoVenta } from "@/tipos";
import { resolverMarcaPorNombre } from "./marcas";
import { registrarMovimientos, type Autor } from "./movimientos";

export interface DatosProducto {
  /** Nombre de la marca tal como se escribió (se busca o se crea en el local). */
  marca: string;
  nombre: string;
  variante: string | null;
  concentracion: Concentracion | null;
  contenidoMl: number | null;
  genero: Genero | null;
  publico: Publico | null;
  categoria: Categoria | null;
  tipo: TipoProducto | null;
  codigo: string;
  precio: number;
  stock: number;
  stockMinimo: number;
}

/** Columnas que se guardan igual al crear y al editar (el stock solo cambia con movimientos). */
function columnas(datos: DatosProducto, marca: { id: string; nombre: string }) {
  const caracteristicas = {
    marca: marca.nombre,
    nombre: datos.nombre,
    variante: datos.variante,
    concentracion: datos.concentracion,
    contenidoMl: datos.contenidoMl,
    // El público solo tiene sentido con un género (Niño / Niña / Infantil unisex)
    genero: datos.genero,
    publico: datos.genero ? datos.publico : null,
    categoria: datos.categoria,
  };
  return {
    nombre: datos.nombre,
    nombreCompleto: armarNombreProducto(caracteristicas),
    nombreBusqueda: textoBusquedaProducto({ ...caracteristicas, tipo: datos.tipo, codigo: datos.codigo }),
    codigo: datos.codigo || null,
    precio: datos.precio,
    stockMinimo: datos.stockMinimo,
    marcaId: marca.id,
    variante: datos.variante,
    concentracion: datos.concentracion,
    contenidoMl: datos.contenidoMl,
    categoria: datos.categoria,
    tipo: datos.tipo,
    genero: caracteristicas.genero,
    publico: caracteristicas.publico,
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
      nombre: productos.nombreCompleto,
      fragancia: productos.nombre,
      busqueda: productos.nombreBusqueda,
      codigo: productos.codigo,
      precio: productos.precio,
      stock: productos.stock,
      stockMinimo: productos.stockMinimo,
      marcaId: productos.marcaId,
      marcaNombre: marcas.nombre,
      variante: productos.variante,
      concentracion: productos.concentracion,
      contenidoMl: productos.contenidoMl,
      categoria: productos.categoria,
      tipo: productos.tipo,
      genero: productos.genero,
      publico: productos.publico,
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
        filtros.categoria ? eq(productos.categoria, filtros.categoria) : undefined,
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
      nombre: productos.nombreCompleto,
      codigo: productos.codigo,
      precio: productos.precio,
      stock: productos.stock,
      busqueda: productos.nombreBusqueda,
    })
    .from(productos)
    .where(and(eq(productos.localId, localId), eq(productos.activo, true), condicion))
    .orderBy(desc(sql`${productos.stock} > 0`), asc(productos.nombreBusqueda))
    .limit(12);
}

/** Un producto para cargarlo en la factura ("Vender" desde el inventario). */
export async function obtenerProductoVenta(localId: string, id: string): Promise<ProductoVenta> {
  const { nombreCompleto, codigo, precio, stock, nombreBusqueda } = await obtenerProducto(localId, id);
  return { id, nombre: nombreCompleto, codigo, precio, stock, busqueda: nombreBusqueda };
}

export async function crearProducto(localId: string, datos: DatosProducto, autor: Autor) {
  const marca = await resolverMarcaPorNombre(localId, datos.marca);
  return db.transaction(async (tx) => {
    const [producto] = await tx
      .insert(productos)
      .values({ localId, ...columnas(datos, marca), stock: datos.stock })
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
  const marca = await resolverMarcaPorNombre(localId, datos.marca, actual.marcaId);
  await db
    .update(productos)
    .set(columnas(datos, marca))
    .where(and(eq(productos.id, id), eq(productos.localId, localId)));
}

/**
 * ¿Ya hay en el local un producto con la misma marca, nombre, variante, concentración y ml?
 * Es solo una ADVERTENCIA (la persona puede continuar): por ejemplo, un tester o un lote distinto.
 * excluirId: el producto que se está editando (no cuenta como duplicado de sí mismo).
 */
export async function buscarDuplicado(
  localId: string,
  datos: Pick<DatosProducto, "marca" | "nombre" | "variante" | "concentracion" | "contenidoMl">,
  excluirId?: string,
): Promise<{ id: string; nombre: string } | null> {
  const candidatos = await db
    .select({
      id: productos.id,
      nombreCompleto: productos.nombreCompleto,
      marca: marcas.nombre,
      nombre: productos.nombre,
      variante: productos.variante,
      concentracion: productos.concentracion,
      contenidoMl: productos.contenidoMl,
    })
    .from(productos)
    .innerJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(
      and(
        eq(productos.localId, localId),
        eq(productos.activo, true),
        sql`lower(${marcas.nombre}) = lower(${datos.marca.trim()})`,
        excluirId ? sql`${productos.id} <> ${excluirId}` : undefined,
      ),
    );
  const buscada = claveDuplicado(datos);
  const igual = candidatos.find((c) => claveDuplicado(c) === buscada);
  return igual ? { id: igual.id, nombre: igual.nombreCompleto } : null;
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
  // El local se repite en la sentencia: nunca se toca un producto de otro local
  const delLocal = and(eq(productos.id, id), eq(productos.localId, localId));
  if (vendido) {
    await db.update(productos).set({ activo: false }).where(delLocal);
  } else {
    await db.delete(productos).where(delLocal);
  }
}

async function obtenerProducto(localId: string, id: string) {
  const producto = await db.query.productos.findFirst({
    where: and(eq(productos.id, id), eq(productos.localId, localId), eq(productos.activo, true)),
  });
  if (!producto) throw new ApiError(404, "El producto no existe en tu local.");
  return producto;
}
