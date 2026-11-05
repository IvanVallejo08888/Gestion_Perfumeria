/**
 * Notificaciones del local:
 *  - COBROS: cuotas vencidas, que vencen hoy o en los próximos días.
 *  - INVENTARIO: productos agotados o con stock bajo.
 */
import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { cuotas, facturas, productos } from "@/db/schema";
import { fecha, pesos, ZONA_HORARIA } from "@/lib/formato";
import type { Notificacion } from "@/tipos";

/** Días de anticipación para avisar de un cobro próximo. */
export const DIAS_AVISO_COBRO = 3;

const diaColombia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA }); // AAAA-MM-DD

export async function listarNotificaciones(localId: string): Promise<Notificacion[]> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + DIAS_AVISO_COBRO * 24 * 60 * 60 * 1000);
  const hoy = diaColombia(ahora);

  const cobros = await db
    .select({
      id: cuotas.id,
      numero: cuotas.numero,
      fechaVencimiento: cuotas.fechaVencimiento,
      pendiente: sql<number>`${cuotas.valor} - ${cuotas.valorPagado}`,
      facturaNumero: facturas.numero,
      clienteNombre: facturas.clienteNombre,
      clienteIdentificacion: facturas.clienteIdentificacion,
      clienteTelefono: facturas.clienteTelefono,
      totalCuotas: sql<number>`(select count(*)::int from cuotas c2 where c2.factura_id = ${facturas.id})`,
    })
    .from(cuotas)
    .innerJoin(facturas, eq(cuotas.facturaId, facturas.id))
    .where(
      and(
        eq(facturas.localId, localId),
        eq(facturas.estado, "PENDIENTE"),
        eq(cuotas.estado, "PENDIENTE"),
        lte(cuotas.fechaVencimiento, limite),
      ),
    )
    .orderBy(asc(cuotas.fechaVencimiento));

  const notificacionesCobro: Notificacion[] = cobros.map((c) => {
    const dia = diaColombia(c.fechaVencimiento);
    const nivel = dia < hoy || (dia === hoy && c.fechaVencimiento < ahora) ? "VENCIDA" : dia === hoy ? "HOY" : "PROXIMA";
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

  const stock = await db
    .select({ id: productos.id, nombre: productos.nombre, stock: productos.stock, minimo: productos.stockMinimo })
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

  return [...notificacionesCobro, ...notificacionesStock];
}

/** Resumen para el contador de la campana (se consulta cada minuto). */
export async function contarNotificaciones(localId: string) {
  const lista = await listarNotificaciones(localId);
  const cobrosUrgentes = lista.filter((n) => n.nivel === "VENCIDA" || n.nivel === "HOY");
  return {
    total: lista.length,
    urgentes: cobrosUrgentes.length,
    // Texto para la notificación del navegador
    mensaje: cobrosUrgentes[0] ? `${cobrosUrgentes[0].titulo} (${fecha(cobrosUrgentes[0].fecha!)})` : null,
  };
}
