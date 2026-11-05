/**
 * Estadísticas y reportes por local y por año (agrupadas por mes, en hora de Colombia).
 *
 *  - Ventas de contado: facturas NORMAL del periodo.
 *  - Ventas a crédito: facturas CREDITO creadas en el periodo (valor total del crédito).
 *  - Recaudo de abonos: dinero recibido por abonos en el periodo.
 *  - Total recaudado = contado + abonos (el dinero que realmente entró).
 */
import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonos, facturaItems, facturas } from "@/db/schema";
import { anioMesColombia, MESES, rangoPeriodo } from "@/lib/formato";
import type { Estadisticas, MesEstadistica } from "@/tipos";
import { obtenerLocal } from "./locales";

export async function obtenerEstadisticas(localId: string, anio: number): Promise<Estadisticas> {
  const local = await obtenerLocal(localId);
  const { inicio, fin } = rangoPeriodo(anio);
  const enPeriodo = and(eq(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));

  const [listaFacturas, listaAbonos, topProductos, [pendientes]] = await Promise.all([
    db.select({ tipo: facturas.tipo, total: facturas.total, creadoEn: facturas.creadoEn }).from(facturas).where(enPeriodo),
    db
      .select({ valor: abonos.valor, creadoEn: abonos.creadoEn })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(and(eq(facturas.localId, localId), gte(abonos.creadoEn, inicio), lt(abonos.creadoEn, fin))),
    db
      .select({
        nombre: facturaItems.nombreProducto,
        cantidad: sql<number>`sum(${facturaItems.cantidad})::int`,
        total: sql<number>`sum(${facturaItems.subtotal})::int`,
      })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(enPeriodo)
      .groupBy(facturaItems.nombreProducto)
      .orderBy(desc(sql`sum(${facturaItems.cantidad})`))
      .limit(10),
    db
      .select({ cantidad: sql<number>`count(*)::int`, saldo: sql<number>`coalesce(sum(${facturas.saldo}), 0)::int` })
      .from(facturas)
      .where(and(eq(facturas.localId, localId), eq(facturas.tipo, "CREDITO"), eq(facturas.estado, "PENDIENTE"))),
  ]);

  // 12 meses vacíos que se van llenando
  const meses: MesEstadistica[] = MESES.map((nombre, i) => ({
    mes: i + 1,
    nombre,
    cantidadContado: 0,
    ventasContado: 0,
    cantidadCredito: 0,
    ventasCredito: 0,
    recaudoAbonos: 0,
    totalVentas: 0,
    totalRecaudado: 0,
  }));

  for (const f of listaFacturas) {
    const m = meses[anioMesColombia(f.creadoEn).mes - 1];
    if (f.tipo === "NORMAL") {
      m.cantidadContado++;
      m.ventasContado += f.total;
    } else {
      m.cantidadCredito++;
      m.ventasCredito += f.total;
    }
  }
  for (const a of listaAbonos) meses[anioMesColombia(a.creadoEn).mes - 1].recaudoAbonos += a.valor;
  for (const m of meses) {
    m.totalVentas = m.ventasContado + m.ventasCredito;
    m.totalRecaudado = m.ventasContado + m.recaudoAbonos;
  }

  const sumar = (campo: keyof Omit<MesEstadistica, "mes" | "nombre">) => meses.reduce((acc, m) => acc + m[campo], 0);

  return {
    local: { id: local.id, nombre: local.nombre },
    anio,
    meses,
    totales: {
      cantidadContado: sumar("cantidadContado"),
      ventasContado: sumar("ventasContado"),
      cantidadCredito: sumar("cantidadCredito"),
      ventasCredito: sumar("ventasCredito"),
      recaudoAbonos: sumar("recaudoAbonos"),
      totalVentas: sumar("totalVentas"),
      totalRecaudado: sumar("totalRecaudado"),
    },
    topProductos,
    creditosPendientes: pendientes ?? { cantidad: 0, saldo: 0 },
  };
}
