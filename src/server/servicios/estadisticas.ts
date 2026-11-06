/**
 * Estadísticas y reportes por local y por año (agrupadas por mes, en hora de Colombia).
 *
 *  - Ventas de contado: facturas NORMAL del periodo.
 *  - Ventas a crédito: facturas CREDITO creadas en el periodo (valor total del crédito).
 *  - Recaudo de abonos: dinero recibido por abonos en el periodo.
 *  - Total recaudado = contado + abonos (el dinero que realmente entró).
 *  - Recibido en efectivo / transferencia = ese mismo dinero, separado por medio de pago.
 *  - Gastos: se agrupan por el día del gasto (no por el día en que se registró).
 *  - Utilidad = total recaudado − gastos.
 */
import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonos, facturaItems, facturas, gastos } from "@/db/schema";
import { anioMesColombia, MESES, rangoDias, rangoPeriodo } from "@/lib/formato";
import type { Estadisticas, MesEstadistica } from "@/tipos";
import { obtenerLocal } from "./locales";

export async function obtenerEstadisticas(localId: string, anio: number): Promise<Estadisticas> {
  const local = await obtenerLocal(localId);
  const { inicio, fin } = rangoPeriodo(anio);
  const enPeriodo = and(eq(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));

  const dias = rangoDias(anio);

  const [listaFacturas, listaAbonos, listaGastos, topProductos, [pendientes]] = await Promise.all([
    db
      .select({
        tipo: facturas.tipo,
        total: facturas.total,
        valorEfectivo: facturas.valorEfectivo,
        valorTransferencia: facturas.valorTransferencia,
        creadoEn: facturas.creadoEn,
      })
      .from(facturas)
      .where(enPeriodo),
    db
      .select({
        valor: abonos.valor,
        valorEfectivo: abonos.valorEfectivo,
        valorTransferencia: abonos.valorTransferencia,
        creadoEn: abonos.creadoEn,
      })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(and(eq(facturas.localId, localId), gte(abonos.creadoEn, inicio), lt(abonos.creadoEn, fin))),
    db
      .select({ valor: gastos.valor, fecha: gastos.fecha })
      .from(gastos)
      .where(and(eq(gastos.localId, localId), gte(gastos.fecha, dias.desde), lt(gastos.fecha, dias.hasta))),
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
    recibidoEfectivo: 0,
    recibidoTransferencia: 0,
    gastos: 0,
    utilidad: 0,
  }));

  for (const f of listaFacturas) {
    const m = meses[anioMesColombia(f.creadoEn).mes - 1];
    if (f.tipo === "NORMAL") {
      m.cantidadContado++;
      m.ventasContado += f.total;
      m.recibidoEfectivo += f.valorEfectivo;
      m.recibidoTransferencia += f.valorTransferencia;
    } else {
      m.cantidadCredito++;
      m.ventasCredito += f.total;
    }
  }
  for (const a of listaAbonos) {
    const m = meses[anioMesColombia(a.creadoEn).mes - 1];
    m.recaudoAbonos += a.valor;
    m.recibidoEfectivo += a.valorEfectivo;
    m.recibidoTransferencia += a.valorTransferencia;
  }
  // La fecha del gasto es "AAAA-MM-DD": el mes se lee directamente del texto
  for (const g of listaGastos) meses[Number(g.fecha.slice(5, 7)) - 1].gastos += g.valor;
  for (const m of meses) {
    m.totalVentas = m.ventasContado + m.ventasCredito;
    m.totalRecaudado = m.ventasContado + m.recaudoAbonos;
    m.utilidad = m.totalRecaudado - m.gastos;
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
      recibidoEfectivo: sumar("recibidoEfectivo"),
      recibidoTransferencia: sumar("recibidoTransferencia"),
      gastos: sumar("gastos"),
      utilidad: sumar("utilidad"),
    },
    topProductos,
    creditosPendientes: pendientes ?? { cantidad: 0, saldo: 0 },
  };
}
