/**
 * Servicio de créditos: búsqueda del cliente (ID, celular o nombre), abonos y fechas de cuotas.
 *
 * Al abonar:
 *  - El valor se aplica a las cuotas en orden (primero la más antigua).
 *  - Cuando el saldo llega a 0, el crédito pasa de PENDIENTE a COMPLETADA
 *    y aparece en el historial de ventas completadas.
 *  - Se devuelve el comprobante del abono (para compartirlo con el cliente).
 *
 * Las ventas anuladas ("Eliminar venta") no aparecen aquí y no admiten abonos ni cambios de fecha.
 */
import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { abonos, clientes, cuotas, facturas, usuarios } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import { escaparLike, normalizarTelefono, normalizarTexto } from "@/lib/formato";
import { idSchema } from "@/lib/validaciones";
import type { ComprobanteAbono } from "@/tipos";
import { obtenerFactura } from "./facturas";
import { resolverPago, type DatosPago } from "./pagos";

/**
 * Condición de búsqueda del cliente: coincidencia parcial, sin distinguir mayúsculas ni tildes.
 *  - Identificación o celular: se comparan solo los dígitos ("300 123" encuentra "3001234567").
 *  - Nombre: cada palabra debe aparecer, en cualquier orden ("perez maria" encuentra "María Pérez").
 * Se busca en la copia guardada en la factura Y en los datos ACTUALES del cliente (por clienteId):
 * así sus créditos se siguen encontrando aunque la cédula, el nombre o el teléfono se corrijan
 * después de la venta (la factura conserva los datos del día de la venta).
 */
function condicionBusquedaCliente(localId: string, texto: string): SQL | undefined {
  const opciones: SQL[] = [ilike(facturas.clienteNombre, `%${escaparLike(texto)}%`)];
  const delCliente: SQL[] = [];
  const digitos = texto.replace(/\D/g, "");
  if (digitos) {
    const parecido = `%${digitos}%`;
    opciones.push(ilike(facturas.clienteIdentificacion, parecido));
    opciones.push(sql`regexp_replace(${facturas.clienteTelefono}, '\\D', '', 'g') like ${parecido}`);
    delCliente.push(ilike(clientes.identificacion, parecido), ilike(clientes.telefonoDigitos, `%${normalizarTelefono(texto)}%`));
  }
  const palabras = normalizarTexto(texto).split(" ").filter(Boolean);
  if (palabras.length) {
    opciones.push(and(...palabras.map((p) => ilike(facturas.clienteNombreBusqueda, `%${escaparLike(p)}%`)))!);
    delCliente.push(and(...palabras.map((p) => ilike(clientes.nombreBusqueda, `%${escaparLike(p)}%`)))!);
  }
  if (delCliente.length) {
    opciones.push(
      inArray(
        facturas.clienteId,
        db.select({ id: clientes.id }).from(clientes).where(and(eq(clientes.localId, localId), or(...delCliente))),
      ),
    );
  }
  return or(...opciones);
}

export async function listarCreditos(localId: string, busqueda?: string) {
  const condiciones = [eq(facturas.localId, localId), eq(facturas.tipo, "CREDITO"), eq(facturas.anulada, false)];
  // Sin búsqueda: solo los créditos pendientes. Con búsqueda: todos los créditos de los clientes que coinciden.
  const texto = busqueda?.trim();
  const condicionCliente = texto ? condicionBusquedaCliente(localId, texto) : undefined;
  if (condicionCliente) condiciones.push(condicionCliente);
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

  const abonoId = await db.transaction(async (tx) => {
    // Bloquea la fila de la factura para evitar dos abonos simultáneos sobre el mismo saldo
    const [factura] = await tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.id, facturaId), eq(facturas.localId, vendedor.localId)))
      .for("update");

    if (!factura || factura.tipo !== "CREDITO") throw new ApiError(404, "El crédito no existe.");
    // La anulación también bloquea esta fila: si llega primero, el abono se rechaza aquí
    if (factura.anulada) throw new ApiError(400, "Esta venta fue eliminada: no se pueden registrar abonos.");
    if (factura.estado === "COMPLETADA") throw new ApiError(400, "Este crédito ya está pagado en su totalidad.");
    if (valor > factura.saldo) {
      throw new ApiError(400, `El abono no puede ser mayor que el saldo pendiente (${factura.saldo.toLocaleString("es-CO")}).`);
    }

    const [nuevo] = await tx
      .insert(abonos)
      .values({ facturaId, usuarioId: vendedor.id, valor, ...reparto, nota: nota || null })
      .returning({ id: abonos.id });

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

    return nuevo.id;
  });

  // La factura actualizada y el comprobante del abono recién creado (para compartirlo sin otra consulta)
  const [factura, abono] = await Promise.all([
    obtenerFactura(vendedor.localId, facturaId),
    obtenerComprobanteAbono(vendedor.localId, abonoId),
  ]);
  return { factura, abono };
}

/**
 * Comprobante de un abono del local del vendedor (si es de otro local o no existe: 404).
 * El número de abono, el total abonado y el saldo se calculan con los abonos de la factura
 * hasta este (en orden de fecha), así que muestran los valores de ESE momento aunque después
 * haya más abonos. Un crédito empieza con saldo = total, por eso saldo = total − abonado.
 */
export async function obtenerComprobanteAbono(localId: string, abonoId: string): Promise<ComprobanteAbono> {
  const noExiste = new ApiError(404, "El abono no existe.");
  if (!idSchema.safeParse(abonoId).success) throw noExiste;

  const abono = await db.query.abonos.findFirst({
    where: eq(abonos.id, abonoId),
    with: {
      factura: {
        columns: {
          id: true,
          localId: true,
          numero: true,
          total: true,
          clienteNombre: true,
          clienteIdentificacion: true,
          clienteTelefono: true,
        },
        with: { local: { columns: { nombre: true, direccion: true, telefono: true } } },
      },
    },
  });
  if (!abono || abono.factura.localId !== localId) throw noExiste;

  const [delCredito, recibio] = await Promise.all([
    db
      .select({ id: abonos.id, valor: abonos.valor })
      .from(abonos)
      .where(eq(abonos.facturaId, abono.facturaId))
      .orderBy(asc(abonos.creadoEn), asc(abonos.id)),
    abono.usuarioId
      ? db.query.usuarios.findFirst({ where: eq(usuarios.id, abono.usuarioId), columns: { nombre: true } })
      : Promise.resolve(undefined),
  ]);

  const posicion = delCredito.findIndex((a) => a.id === abono.id);
  const totalAbonado = delCredito.slice(0, posicion + 1).reduce((suma, a) => suma + a.valor, 0);
  const { local, localId: _local, ...factura } = abono.factura;

  return {
    id: abono.id,
    numero: posicion + 1,
    valor: abono.valor,
    medioPago: abono.medioPago,
    valorEfectivo: abono.valorEfectivo,
    valorTransferencia: abono.valorTransferencia,
    creadoEn: abono.creadoEn.toISOString(),
    anulado: abono.anulado,
    recibidoPor: recibio?.nombre ?? null,
    totalAbonado,
    saldo: Math.max(0, factura.total - totalAbonado),
    factura,
    local,
  };
}

/** Cambia la fecha y hora de cobro de una cuota que aún no se ha pagado. */
export async function cambiarFechaCuota(localId: string, cuotaId: string, fechaVencimiento: Date) {
  const cuota = await db.query.cuotas.findFirst({
    where: eq(cuotas.id, cuotaId),
    with: { factura: { columns: { localId: true, anulada: true } } },
  });
  if (!cuota || cuota.factura.localId !== localId) throw new ApiError(404, "La cuota no existe.");
  if (cuota.factura.anulada) throw new ApiError(400, "Esta venta fue eliminada: ya no se pueden cambiar sus fechas de cobro.");
  if (cuota.estado === "PAGADA") throw new ApiError(400, "No se puede cambiar la fecha de una cuota ya pagada.");
  await db.update(cuotas).set({ fechaVencimiento }).where(eq(cuotas.id, cuotaId));
}
