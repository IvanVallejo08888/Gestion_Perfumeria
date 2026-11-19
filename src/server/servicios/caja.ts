/**
 * Caja del día (y por rango de días, para el Excel «Caja diaria»).
 * Arma la lista de movimientos de dinero del local; las sumas las hace src/lib/caja.ts (con pruebas).
 *
 *  - Ventas de contado y abonos: por su fecha y hora de registro.
 *  - Gastos de contado: por el día del gasto (si se registró ese mismo día, con su hora).
 *    Los gastos a crédito NO aparecen: el dinero sale con cada pago de la deuda.
 *  - Pagos de deudas: por la fecha y hora del pago.
 *  - Pagos a proveedores (compras de mercancía): solo informativos, no se restan (ver src/lib/caja.ts).
 *  - Nada anulado cuenta.
 */
import "server-only";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { abonos, abonosProveedor, comprasMercancia, facturas, gastos } from "@/db/schema";
import { calcularCaja, ordenarMovimientos, type MovimientoCaja } from "@/lib/caja";
import { hoyColombia, numeroFactura } from "@/lib/formato";
import type { CajaDia } from "@/tipos";
import { pagosDeudasEnRango } from "./deudas";

/** Instante en que empieza un día de Colombia (UTC-5, sin horario de verano). */
const inicioDelDia = (dia: string) => new Date(`${dia}T00:00:00-05:00`);

/** Día siguiente a "AAAA-MM-DD". */
function diaSiguiente(dia: string): string {
  return hoyColombia(new Date(inicioDelDia(dia).getTime() + 36 * 60 * 60 * 1000));
}

/**
 * Movimientos de caja de los días [desde, hasta) del local, y los pagos a proveedores (informativos).
 * desde/hasta: "AAAA-MM-DD".
 */
export async function movimientosCaja(localId: string, desde: string, hasta: string) {
  const inicio = inicioDelDia(desde);
  const fin = inicioDelDia(hasta);

  const [ventas, listaAbonos, listaGastos, pagos, proveedor] = await Promise.all([
    db
      .select({
        numero: facturas.numero,
        cliente: facturas.clienteNombre,
        creadoEn: facturas.creadoEn,
        efectivo: facturas.valorEfectivo,
        transferencia: facturas.valorTransferencia,
      })
      .from(facturas)
      .where(
        and(
          eq(facturas.localId, localId),
          eq(facturas.tipo, "NORMAL"),
          eq(facturas.anulada, false),
          gte(facturas.creadoEn, inicio),
          lt(facturas.creadoEn, fin),
        ),
      ),
    db
      .select({
        numero: facturas.numero,
        cliente: facturas.clienteNombre,
        creadoEn: abonos.creadoEn,
        efectivo: abonos.valorEfectivo,
        transferencia: abonos.valorTransferencia,
      })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(
        and(
          eq(facturas.localId, localId),
          eq(facturas.anulada, false),
          eq(abonos.anulado, false),
          gte(abonos.creadoEn, inicio),
          lt(abonos.creadoEn, fin),
        ),
      ),
    db
      .select({
        fecha: gastos.fecha,
        creadoEn: gastos.creadoEn,
        categoria: gastos.categoriaNombre,
        descripcion: gastos.descripcion,
        personal: gastos.personal,
        medioPago: gastos.medioPago,
        valor: gastos.valor,
      })
      .from(gastos)
      .where(
        and(
          eq(gastos.localId, localId),
          eq(gastos.anulado, false),
          ne(gastos.medioPago, "CREDITO"),
          gte(gastos.fecha, desde),
          lt(gastos.fecha, hasta),
        ),
      ),
    pagosDeudasEnRango(localId, inicio, fin),
    db
      .select({
        fecha: abonosProveedor.fecha,
        creadoEn: abonosProveedor.creadoEn,
        proveedor: comprasMercancia.proveedorNombre,
        producto: comprasMercancia.productoNombre,
        efectivo: abonosProveedor.valorEfectivo,
        transferencia: abonosProveedor.valorTransferencia,
      })
      .from(abonosProveedor)
      .innerJoin(comprasMercancia, eq(abonosProveedor.compraId, comprasMercancia.id))
      .where(and(eq(comprasMercancia.localId, localId), gte(abonosProveedor.fecha, desde), lt(abonosProveedor.fecha, hasta)))
      .orderBy(asc(abonosProveedor.fecha)),
  ]);

  // Hora de un registro que solo guarda el día: la de creación, si se registró ese mismo día
  const horaSiMismoDia = (dia: string, creadoEn: Date) => (hoyColombia(creadoEn) === dia ? creadoEn.toISOString() : null);

  const movimientos: MovimientoCaja[] = [
    ...ventas.map((v) => ({
      tipo: "VENTA" as const,
      dia: hoyColombia(v.creadoEn),
      hora: v.creadoEn.toISOString(),
      descripcion: `Factura ${numeroFactura(v.numero)} · ${v.cliente}`,
      efectivo: v.efectivo,
      transferencia: v.transferencia,
    })),
    ...listaAbonos.map((a) => ({
      tipo: "ABONO" as const,
      dia: hoyColombia(a.creadoEn),
      hora: a.creadoEn.toISOString(),
      descripcion: `Abono · Factura ${numeroFactura(a.numero)} · ${a.cliente}`,
      efectivo: a.efectivo,
      transferencia: a.transferencia,
    })),
    ...listaGastos.map((g) => ({
      tipo: "GASTO" as const,
      dia: g.fecha,
      hora: horaSiMismoDia(g.fecha, g.creadoEn),
      descripcion: [g.categoria, g.descripcion, g.personal ? "(personal)" : null].filter(Boolean).join(" · "),
      efectivo: g.medioPago === "EFECTIVO" ? g.valor : 0,
      transferencia: g.medioPago === "TRANSFERENCIA" ? g.valor : 0,
    })),
    ...pagos.map((p) => ({
      tipo: "PAGO_DEUDA" as const,
      dia: hoyColombia(p.fecha),
      hora: p.fecha.toISOString(),
      descripcion: `Pago a ${p.acreedor}${p.personal ? " (personal)" : ""}`,
      efectivo: p.valorEfectivo,
      transferencia: p.valorTransferencia,
    })),
  ];

  const pagosProveedores = proveedor.map((p) => ({
    dia: p.fecha,
    hora: horaSiMismoDia(p.fecha, p.creadoEn),
    descripcion: `${p.proveedor} · ${p.producto}`,
    efectivo: p.efectivo,
    transferencia: p.transferencia,
  }));

  return { movimientos: ordenarMovimientos(movimientos), pagosProveedores };
}

/** Caja de UN día ("AAAA-MM-DD"): entradas, salidas, saldo y el detalle de cada movimiento. */
export async function obtenerCaja(localId: string, dia: string): Promise<CajaDia> {
  const { movimientos, pagosProveedores } = await movimientosCaja(localId, dia, diaSiguiente(dia));
  return {
    fecha: dia,
    resumen: calcularCaja(movimientos),
    movimientos,
    pagosProveedores,
    totalPagosProveedores: pagosProveedores.reduce((a, p) => a + p.efectivo + p.transferencia, 0),
  };
}

