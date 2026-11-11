/**
 * Dashboard de reportes (vendedor: su local · administrador: un local o el consolidado).
 *
 * TODO se agrega en SQL: al servidor solo llegan los totales ya calculados (nunca las facturas).
 *
 *  - Ventas por categoría (público, tipo, marca, tamaño): salen de la COPIA guardada en
 *    factura_items al vender, no del producto actual. Si luego se reclasifica un perfume,
 *    las ventas viejas no cambian. Sin copia (facturas anteriores) → "Sin categoría".
 *  - Total vendido = contado + créditos otorgados en el periodo.
 *  - Recaudado = contado + abonos recibidos en el periodo (el dinero que entró).
 *  - Inventario, cartera pendiente y agotados = foto de HOY (no dependen del periodo).
 *  - La gráfica mes a mes muestra siempre los 12 meses del año elegido (hora de Colombia).
 */
import "server-only";
import { and, asc, desc, eq, gte, lt, lte, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { abonos, facturaItems, facturas, locales, marcas, productos } from "@/db/schema";
import {
  completarCortes,
  CORTES_PUBLICO,
  CORTES_TAMANO,
  CORTES_TIPO,
  ordenarCortes,
  topConOtras,
  type CorteVenta,
  type FilaCorte,
} from "@/lib/dashboard";
import { MESES, rangoPeriodo, ZONA_HORARIA } from "@/lib/formato";
import type { Dashboard, ProductoTop } from "@/tipos";
import { obtenerLocal } from "./locales";

export interface AlcanceDashboard {
  /** Sin local = todos los locales (consolidado del administrador). */
  localId?: string;
  anio: number;
  mes?: number;
}

/** Suma como bigint (un consolidado puede pasar el límite de un entero) y la entrega como número. */
const suma = (expresion: SQL | AnyColumn) => sql<number>`coalesce(sum(${expresion}), 0)::bigint`.mapWith(Number);
const conteo = sql<number>`count(*)::int`;

/** "HOMBRE_ADULTO"… o null si falta el género o el público (misma clave de clavePublico). */
const clavePublicoSql = (genero: AnyColumn, publico: AnyColumn) => sql<string | null>`${genero}::text || '_' || ${publico}::text`;

const zona = sql.raw(`'${ZONA_HORARIA}'`);
const mesDe = (columna: AnyColumn) => sql<number>`extract(month from ${columna} at time zone ${zona})::int`;

const delLocal = (columna: AnyColumn, localId?: string) => (localId ? eq(columna, localId) : undefined);

/* ------------------------- Ventas por categoría ------------------------- */

export interface VentasPorCategoria {
  porPublico: CorteVenta[];
  porTipo: CorteVenta[];
  /** Todas las marcas, de mayor a menor valor (el dashboard muestra top 8 + "Otras"). */
  porMarca: CorteVenta[];
  porTamano: CorteVenta[];
}

/** Los mismos cortes para el dashboard y para la hoja "Ventas por categoría" del Excel. */
export async function ventasPorCategoria({ localId, anio, mes }: AlcanceDashboard): Promise<VentasPorCategoria> {
  const { inicio, fin } = rangoPeriodo(anio, mes);
  const enPeriodo = and(delLocal(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));

  // Un GROUP BY por corte. Se agrupa por la primera columna del SELECT ("group by 1").
  const corte = (clave: SQL<string | null>, etiqueta: SQL<string | null> = sql<string | null>`null`): Promise<FilaCorte[]> =>
    db
      .select({
        clave,
        etiqueta,
        unidades: suma(facturaItems.cantidad),
        valor: suma(facturaItems.subtotal),
      })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(enPeriodo)
      .groupBy(sql`1`);

  const [publico, tipo, tamano, marca] = await Promise.all([
    corte(clavePublicoSql(facturaItems.genero, facturaItems.publico)),
    corte(sql<string | null>`${facturaItems.tipo}::text`),
    corte(sql<string | null>`${facturaItems.tamano}::text`),
    // La marca se agrupa sin importar mayúsculas (dos locales pueden escribirla distinto)
    corte(sql<string | null>`lower(${facturaItems.marcaNombre})`, sql<string | null>`min(${facturaItems.marcaNombre})`),
  ]);

  return {
    porPublico: completarCortes(CORTES_PUBLICO, publico),
    porTipo: completarCortes(CORTES_TIPO, tipo),
    porMarca: ordenarCortes(marca),
    porTamano: completarCortes(CORTES_TAMANO, tamano),
  };
}

/* -------------------------------- Dashboard -------------------------------- */

const TOP_PRODUCTOS = 10;
const TOP_MARCAS = 8;
const LIMITE_CRITICOS = 20;

export async function obtenerDashboard(alcance: AlcanceDashboard): Promise<Dashboard> {
  const { localId, anio, mes } = alcance;
  const local = localId ? await obtenerLocal(localId) : null;

  const periodo = rangoPeriodo(anio, mes);
  const todoElAnio = rangoPeriodo(anio);
  const facturasEn = (r: { inicio: Date; fin: Date }) =>
    and(delLocal(facturas.localId, localId), gte(facturas.creadoEn, r.inicio), lt(facturas.creadoEn, r.fin));
  const abonosEn = (r: { inicio: Date; fin: Date }) =>
    and(delLocal(facturas.localId, localId), gte(abonos.creadoEn, r.inicio), lt(abonos.creadoEn, r.fin));
  const inventarioActivo = and(delLocal(productos.localId, localId), eq(productos.activo, true));
  const critico = and(inventarioActivo, lte(productos.stock, productos.stockMinimo));

  const sumaContado = sql<number>`coalesce(sum(${facturas.total}) filter (where ${facturas.tipo} = 'NORMAL'), 0)::bigint`.mapWith(Number);
  const sumaCredito = sql<number>`coalesce(sum(${facturas.total}) filter (where ${facturas.tipo} = 'CREDITO'), 0)::bigint`.mapWith(Number);

  const top = (orden: SQL): Promise<ProductoTop[]> =>
    db
      .select({ nombre: facturaItems.nombreProducto, unidades: suma(facturaItems.cantidad), valor: suma(facturaItems.subtotal) })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(facturasEn(periodo))
      .groupBy(facturaItems.nombreProducto)
      .orderBy(desc(orden), asc(facturaItems.nombreProducto))
      .limit(TOP_PRODUCTOS);

  const [
    [ventas],
    [abonosPeriodo],
    [unidades],
    [inventario],
    [cartera],
    topPorUnidades,
    topPorValor,
    categorias,
    ventasMes,
    abonosMes,
    stockPublico,
    criticos,
    [{ total: totalCriticos }],
  ] = await Promise.all([
    db.select({ total: suma(facturas.total), contado: sumaContado }).from(facturas).where(facturasEn(periodo)),
    db.select({ total: suma(abonos.valor) }).from(abonos).innerJoin(facturas, eq(abonos.facturaId, facturas.id)).where(abonosEn(periodo)),
    db
      .select({ total: suma(facturaItems.cantidad) })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(facturasEn(periodo)),
    db
      .select({
        valor: suma(sql`greatest(${productos.stock}, 0)::bigint * ${productos.precio}`),
        agotados: sql<number>`count(*) filter (where ${productos.stock} <= 0)::int`,
      })
      .from(productos)
      .where(inventarioActivo),
    db
      .select({ cantidad: conteo, saldo: suma(facturas.saldo) })
      .from(facturas)
      .where(and(delLocal(facturas.localId, localId), eq(facturas.tipo, "CREDITO"), eq(facturas.estado, "PENDIENTE"))),
    top(sql`sum(${facturaItems.cantidad})`),
    top(sql`sum(${facturaItems.subtotal})`),
    ventasPorCategoria(alcance),
    db
      .select({ mes: mesDe(facturas.creadoEn), contado: sumaContado, credito: sumaCredito })
      .from(facturas)
      .where(facturasEn(todoElAnio))
      .groupBy(sql`1`),
    db
      .select({ mes: mesDe(abonos.creadoEn), total: suma(abonos.valor) })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(abonosEn(todoElAnio))
      .groupBy(sql`1`),
    db
      .select({ clave: clavePublicoSql(productos.genero, productos.publico), unidades: suma(sql`greatest(${productos.stock}, 0)`) })
      .from(productos)
      .where(inventarioActivo)
      .groupBy(sql`1`),
    db
      .select({
        id: productos.id,
        nombre: productos.nombre,
        marcaNombre: marcas.nombre,
        stock: productos.stock,
        stockMinimo: productos.stockMinimo,
        localNombre: locales.nombre,
      })
      .from(productos)
      .innerJoin(locales, eq(locales.id, productos.localId))
      .leftJoin(marcas, eq(marcas.id, productos.marcaId))
      .where(critico)
      // Primero los agotados, luego los que menos unidades tienen
      .orderBy(asc(productos.stock), asc(productos.nombreBusqueda))
      .limit(LIMITE_CRITICOS),
    db.select({ total: conteo }).from(productos).where(critico),
  ]);

  const contadoDelMes = new Map(ventasMes.map((m) => [m.mes, m]));
  const abonosDelMes = new Map(abonosMes.map((m) => [m.mes, m.total]));

  return {
    alcance: { localId: local?.id ?? null, localNombre: local?.nombre ?? "Todos los locales" },
    anio,
    mes: mes ?? null,
    kpis: {
      totalVendido: ventas.total,
      recaudado: ventas.contado + abonosPeriodo.total,
      unidadesVendidas: unidades.total,
      valorInventario: inventario.valor,
      carteraPendiente: cartera.saldo,
      creditosPendientes: cartera.cantidad,
      perfumesAgotados: inventario.agotados,
    },
    topPorUnidades,
    topPorValor,
    porPublico: categorias.porPublico,
    porTipo: categorias.porTipo,
    porMarca: topConOtras(categorias.porMarca, TOP_MARCAS),
    porTamano: categorias.porTamano,
    meses: MESES.map((nombre, i) => {
      const contado = contadoDelMes.get(i + 1)?.contado ?? 0;
      return {
        mes: i + 1,
        nombre,
        contado,
        credito: contadoDelMes.get(i + 1)?.credito ?? 0,
        recaudo: contado + (abonosDelMes.get(i + 1) ?? 0),
      };
    }),
    inventario: {
      porPublico: completarCortes(
        CORTES_PUBLICO,
        stockPublico.map((s) => ({ clave: s.clave, unidades: s.unidades, valor: 0 })),
      ).map(({ clave, etiqueta, unidades }) => ({ clave, etiqueta, unidades })),
      // En el reporte de un solo local el nombre del local sobra
      criticos: criticos.map((c) => ({ ...c, localNombre: local ? null : c.localNombre })),
      totalCriticos,
    },
  };
}
