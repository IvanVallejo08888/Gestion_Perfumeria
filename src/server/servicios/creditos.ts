/**
 * Servicio de créditos: consulta por identificación del cliente, abonos y fechas de cuotas.
 *
 * Al abonar:
 *  - El valor se aplica a las cuotas en orden (primero la más antigua).
 *  - Cuando el saldo llega a 0, el crédito pasa de PENDIENTE a COMPLETADA
 *    y aparece en el historial de ventas completadas.
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { abonos, cuotas, facturas } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import { obtenerFactura } from "./facturas";
import { resolverPago, type DatosPago } from "./pagos";

export async function listarCreditos(localId: string, identificacion?: string) {
  const condiciones = [eq(facturas.localId, localId), eq(facturas.tipo, "CREDITO")];
  // Sin identificación: solo los créditos pendientes. Con identificación: todos los del cliente.
  if (identificacion?.trim()) condiciones.push(eq(facturas.clienteIdentificacion, identificacion.trim()));
  else condiciones.push(eq(facturas.estado, "PENDIENTE"));

  const lista = await db.query.facturas.findMany({
    where: and(...condiciones),
    columns: {
      id: true,
      numero: true,
      estado: true,
      clienteNombre: true,
      clienteIdentificacion: true,
      clienteTelefono: true,
      total: true,
      saldo: true,
      creadoEn: true,
      completadaEn: true,
    },
    with: { cuotas: { orderBy: asc(cuotas.numero), columns: { fechaVencimiento: true, estado: true } } },
    orderBy: [asc(facturas.estado), desc(facturas.creadoEn)],
    limit: 200,
  });

  return lista.map(({ cuotas: listaCuotas, ...f }) => {
    const proxima = listaCuotas.find((c) => c.estado === "PENDIENTE");
    return {
      ...f,
      creadoEn: f.creadoEn.toISOString(),
      completadaEn: f.completadaEn?.toISOString() ?? null,
      totalCuotas: listaCuotas.length,
      cuotasPagadas: listaCuotas.filter((c) => c.estado === "PAGADA").length,
      proximaCuota: proxima?.fechaVencimiento.toISOString() ?? null,
    };
  });
}

export type CreditoResumen = Awaited<ReturnType<typeof listarCreditos>>[number];

export async function registrarAbono(vendedor: VendedorSesion, facturaId: string, valor: number, pago: DatosPago, nota?: string) {
  // El medio de pago se valida sobre el valor del abono, con la misma lógica de la factura
  const reparto = resolverPago(pago, valor);

  await db.transaction(async (tx) => {
    // Bloquea la fila de la factura para evitar dos abonos simultáneos sobre el mismo saldo
    const [factura] = await tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.id, facturaId), eq(facturas.localId, vendedor.localId)))
      .for("update");

    if (!factura || factura.tipo !== "CREDITO") throw new ApiError(404, "El crédito no existe.");
    if (factura.estado === "COMPLETADA") throw new ApiError(400, "Este crédito ya está pagado en su totalidad.");
    if (valor > factura.saldo) {
      throw new ApiError(400, `El abono no puede ser mayor que el saldo pendiente (${factura.saldo.toLocaleString("es-CO")}).`);
    }

    await tx.insert(abonos).values({ facturaId, usuarioId: vendedor.id, valor, ...reparto, nota: nota || null });

    // Aplicar el abono a las cuotas pendientes, en orden
    const pendientes = await tx
      .select()
      .from(cuotas)
      .where(and(eq(cuotas.facturaId, facturaId), eq(cuotas.estado, "PENDIENTE")))
      .orderBy(asc(cuotas.numero));

    let restante = valor;
    const ahora = new Date();
    for (const cuota of pendientes) {
      if (restante <= 0) break;
      const falta = cuota.valor - cuota.valorPagado;
      const aplicado = Math.min(falta, restante);
      restante -= aplicado;
      const pagada = cuota.valorPagado + aplicado >= cuota.valor;
      await tx
        .update(cuotas)
        .set({ valorPagado: cuota.valorPagado + aplicado, estado: pagada ? "PAGADA" : "PENDIENTE", pagadaEn: pagada ? ahora : null })
        .where(eq(cuotas.id, cuota.id));
    }

    const nuevoSaldo = factura.saldo - valor;
    await tx
      .update(facturas)
      .set({
        saldo: nuevoSaldo,
        estado: nuevoSaldo === 0 ? "COMPLETADA" : "PENDIENTE",
        completadaEn: nuevoSaldo === 0 ? ahora : null,
      })
      .where(eq(facturas.id, facturaId));
  });

  return obtenerFactura(vendedor.localId, facturaId);
}

/** Cambia la fecha y hora de cobro de una cuota que aún no se ha pagado. */
export async function cambiarFechaCuota(localId: string, cuotaId: string, fechaVencimiento: Date) {
  const cuota = await db.query.cuotas.findFirst({
    where: eq(cuotas.id, cuotaId),
    with: { factura: { columns: { localId: true } } },
  });
  if (!cuota || cuota.factura.localId !== localId) throw new ApiError(404, "La cuota no existe.");
  if (cuota.estado === "PAGADA") throw new ApiError(400, "No se puede cambiar la fecha de una cuota ya pagada.");
  await db.update(cuotas).set({ fechaVencimiento }).where(eq(cuotas.id, cuotaId));
}
