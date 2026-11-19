/**
 * Notificaciones del local:
 *  - COBROS: cuotas de clientes vencidas, que vencen hoy o en los próximos días.
 *  - DEUDAS: cuotas de las deudas del negocio (gastos a crédito) vencidas, de hoy o próximas.
 *    Las deudas pagadas o anuladas nunca avisan.
 *  - INVENTARIO: productos agotados o con stock bajo.
 */
import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, cuotas, deudaCuotas, deudas, facturas, productos } from "@/db/schema";
import { DIAS_AVISO_PAGO, nivelRecordatorio } from "@/lib/deudas";
import { fecha, fechaHora, pesos } from "@/lib/formato";
import type { Notificacion } from "@/tipos";

/** Días de anticipación para avisar de un cobro próximo. */
export const DIAS_AVISO_COBRO = 3;

const UN_DIA = 24 * 60 * 60 * 1000;

export async function listarNotificaciones(localId: string): Promise<Notificacion[]> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + DIAS_AVISO_COBRO * UN_DIA);

  const cobros = await db
    .select({
      id: cuotas.id,
      numero: cuotas.numero,
      fechaVencimiento: cuotas.fechaVencimiento,
      pendiente: sql<number>`${cuotas.valor} - ${cuotas.valorPagado}`,
      facturaNumero: facturas.numero,
      clienteNombre: facturas.clienteNombre,
      // Cédula ACTUAL del cliente (no la copia de la factura): el enlace "Ver créditos"
      // sigue funcionando aunque la cédula se haya corregido después de la venta
      clienteIdentificacion: clientes.identificacion,
      clienteTelefono: facturas.clienteTelefono,
      totalCuotas: sql<number>`(select count(*)::int from cuotas c2 where c2.factura_id = ${facturas.id})`,
    })
    .from(cuotas)
    .innerJoin(facturas, eq(cuotas.facturaId, facturas.id))
    .innerJoin(clientes, eq(facturas.clienteId, clientes.id))
    .where(
      and(
        eq(facturas.localId, localId),
        // Las ventas anuladas (y sus cuotas) nunca generan avisos de cobro
        eq(facturas.anulada, false),
        eq(cuotas.anulada, false),
        eq(facturas.estado, "PENDIENTE"),
        eq(cuotas.estado, "PENDIENTE"),
        lte(cuotas.fechaVencimiento, limite),
      ),
    )
    .orderBy(asc(cuotas.fechaVencimiento));

  const notificacionesCobro: Notificacion[] = cobros.map((c) => {
    const nivel = nivelRecordatorio(c.fechaVencimiento, ahora);
    const encabezado = nivel === "VENCIDA" ? "Cobro vencido" : nivel === "HOY" ? "Cobrar hoy" : "Cobro próximo";
    return {
      id: `cuota-${c.id}`,
      tipo: "COBRO",
      nivel,
      titulo: `${encabezado}: ${c.clienteNombre}`,
      descripcion: `Cuota ${c.numero} de ${c.totalCuotas} · ${pesos(c.pendiente)} · Factura ${c.facturaNumero} · Tel. ${c.clienteTelefono}`,
      fecha: c.fechaVencimiento.toISOString(),
      clienteIdentificacion: c.clienteIdentificacion,
    };
  });

  // Pagos de deudas del negocio: solo deudas PENDIENTES y cuotas PENDIENTES (nunca pagadas ni anuladas)
  const limitePagos = new Date(ahora.getTime() + DIAS_AVISO_PAGO * UN_DIA);
  const pagos = await db
    .select({
      id: deudaCuotas.id,
      deudaId: deudas.id,
      numero: deudaCuotas.numero,
      fechaVencimiento: deudaCuotas.fechaVencimiento,
      pendiente: sql<number>`(${deudaCuotas.valor} - ${deudaCuotas.valorPagado})::int`,
      acreedor: deudas.acreedor,
      totalCuotas: sql<number>`(select count(*)::int from deuda_cuotas c2 where c2.deuda_id = ${deudas.id})`,
    })
    .from(deudaCuotas)
    .innerJoin(deudas, eq(deudaCuotas.deudaId, deudas.id))
    .where(
      and(
        eq(deudas.localId, localId),
        eq(deudas.estado, "PENDIENTE"),
        eq(deudaCuotas.estado, "PENDIENTE"),
        lte(deudaCuotas.fechaVencimiento, limitePagos),
      ),
    )
    .orderBy(asc(deudaCuotas.fechaVencimiento));

  const notificacionesDeuda: Notificacion[] = pagos.map((p) => {
    const nivel = nivelRecordatorio(p.fechaVencimiento, ahora);
    const encabezado = nivel === "VENCIDA" ? "Pago vencido" : nivel === "HOY" ? "Pagar hoy" : "Pago próximo";
    return {
      id: `deuda-cuota-${p.id}`,
      tipo: "DEUDA",
      nivel,
      titulo: `${encabezado}: ${p.acreedor}`,
      descripcion: `Cuota ${p.numero} de ${p.totalCuotas} · ${pesos(p.pendiente)} · vence el ${fechaHora(p.fechaVencimiento)}`,
      fecha: p.fechaVencimiento.toISOString(),
      deudaId: p.deudaId,
      acreedor: p.acreedor,
      valor: p.pendiente,
    };
  });

  const stock = await db
    .select({ id: productos.id, nombre: productos.nombreCompleto, stock: productos.stock, minimo: productos.stockMinimo })
    .from(productos)
    .where(and(eq(productos.localId, localId), eq(productos.activo, true), lte(productos.stock, productos.stockMinimo)))
    .orderBy(asc(productos.stock), asc(productos.nombreBusqueda))
    .limit(100);

  const notificacionesStock: Notificacion[] = stock.map((p) => ({
    id: `stock-${p.id}`,
    tipo: "STOCK",
    nivel: p.stock === 0 ? "STOCK_AGOTADO" : "STOCK_BAJO",
    titulo: p.stock === 0 ? `Producto agotado: ${p.nombre}` : `Stock bajo: ${p.nombre}`,
    descripcion: p.stock === 0 ? "No quedan unidades. No se puede vender." : `Quedan ${p.stock} unidades (mínimo ${p.minimo}).`,
    fecha: null,
  }));

  return [...notificacionesCobro, ...notificacionesDeuda, ...notificacionesStock];
}

/** Aviso del navegador (y del service worker): uno por tipo, con su propia etiqueta para que no se tapen. */
export interface AvisoNavegador {
  /** Distinto para cobros y deudas: un aviso de deuda no reemplaza al de cobro. */
  etiqueta: "cobro" | "deuda";
  titulo: string;
  cuerpo: string;
  /** Dónde lleva al tocar el aviso. */
  url: string;
}

const esUrgente = (n: Notificacion) => n.nivel === "VENCIDA" || n.nivel === "HOY";

/** Resumen para el contador de la campana (se consulta cada minuto). Urgentes = cobros y pagos vencidos o de hoy. */
export async function contarNotificaciones(localId: string) {
  const lista = await listarNotificaciones(localId);
  const urgentes = lista.filter(esUrgente);
  const cobro = urgentes.find((n) => n.tipo === "COBRO");
  const deuda = urgentes.find((n) => n.tipo === "DEUDA");

  const avisos: AvisoNavegador[] = [];
  if (cobro) {
    avisos.push({
      etiqueta: "cobro",
      titulo: "Recordatorio de cobro",
      cuerpo: `${cobro.titulo} (${fecha(cobro.fecha!)})`,
      url: "/panel/notificaciones",
    });
  }
  if (deuda) {
    // "Hoy debes pagar $ 300.000 a Distribuidora Aromas" / "Pago vencido: debes $ … a … desde el …"
    const valor = pesos(deuda.valor ?? 0);
    const acreedor = deuda.acreedor ?? "";
    avisos.push({
      etiqueta: "deuda",
      titulo: "Recordatorio de pago",
      cuerpo:
        deuda.nivel === "HOY"
          ? `Hoy debes pagar ${valor} a ${acreedor}`
          : `Pago vencido: debes ${valor} a ${acreedor} desde el ${fecha(deuda.fecha!)}`,
      url: `/panel/gastos?pestana=deudas&pagar=${deuda.deudaId}`,
    });
  }

  return {
    total: lista.length,
    urgentes: urgentes.length,
    // Se conserva por compatibilidad (pestañas abiertas con la versión anterior): el primer aviso
    mensaje: avisos[0]?.cuerpo ?? null,
    avisos,
  };
}
