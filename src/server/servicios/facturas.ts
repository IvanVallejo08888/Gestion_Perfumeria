/**
 * Servicio de facturación.
 *
 * Al registrar una factura, TODO ocurre dentro de una transacción:
 *   1. Guarda o actualiza el cliente.
 *   2. Descuenta el stock de cada producto (si no alcanza, se cancela toda la venta).
 *   3. Asigna el número consecutivo del local.
 *   4. Calcula el medio de pago (contado): efectivo + transferencia = total.
 *   5. Guarda la factura, sus productos, un movimiento VENTA por producto y (si es crédito) sus cuotas.
 * Si algo falla, no se guarda nada y el inventario queda intacto.
 *
 * Una venta NUNCA se borra: "Eliminar venta" la ANULA (anularFactura), devuelve los
 * productos al inventario y la deja en el historial con el motivo, quién y cuándo.
 */
import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { abonos, clientes, cuotas, facturaItems, facturas, locales, marcas, productos, sectores } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import { camposBusquedaCliente, escaparLike, normalizarTexto } from "@/lib/formato";
import type { ClienteDatos, FacturaDetalle, FacturaResumen, MedioPago, ResultadoAnulacion } from "@/tipos";
import { registrarMovimientos } from "./movimientos";
import { resolverPago } from "./pagos";

export interface DatosNuevaFactura {
  tipo: "NORMAL" | "CREDITO";
  cliente: ClienteDatos;
  items: { productoId: string; cantidad: number }[];
  adicional: number;
  descuento: number;
  notas?: string;
  cuotas?: { fechaVencimiento: string }[];
  medioPago?: MedioPago;
  valorTransferencia?: number;
  valorEfectivo?: number;
}

export async function crearFactura(vendedor: VendedorSesion, datos: DatosNuevaFactura): Promise<string> {
  const localId = vendedor.localId;

  // Si el mismo producto viene dos veces, se suman las cantidades
  const cantidades = new Map<string, number>();
  for (const item of datos.items) cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);

  return db.transaction(async (tx) => {
    /* El sector debe ser uno de los activos del local; en la factura se guarda su nombre */
    const sector = await tx.query.sectores.findFirst({
      where: and(eq(sectores.localId, localId), eq(sectores.nombre, datos.cliente.sector), eq(sectores.activo, true)),
    });
    if (!sector) throw new ApiError(400, "El sector elegido no existe o está desactivado en este local.");

    /* 1. Cliente: se crea o se actualizan sus datos (con sus columnas de búsqueda al día) */
    const busqueda = camposBusquedaCliente(datos.cliente.nombre, datos.cliente.telefono);
    const [cliente] = await tx
      .insert(clientes)
      .values({ localId, ...datos.cliente, ...busqueda })
      .onConflictDoUpdate({
        target: [clientes.localId, clientes.identificacion],
        set: {
          nombre: datos.cliente.nombre,
          telefono: datos.cliente.telefono,
          direccion: datos.cliente.direccion,
          sector: datos.cliente.sector,
          ...busqueda,
          actualizadoEn: new Date(),
        },
      })
      .returning();

    /* 2. Descontar inventario (solo si hay stock suficiente) */
    const lineas: {
      productoId: string;
      nombre: string;
      precio: number;
      cantidad: number;
      /** Stock que quedó después de descontar (para el movimiento VENTA). */
      stockResultante: number;
      clasificacion: Pick<typeof productos.$inferSelect, "marcaId" | "tipo" | "genero" | "publico" | "contenidoMl" | "concentracion" | "categoria">;
    }[] = [];
    for (const [productoId, cantidad] of cantidades) {
      const [actualizado] = await tx
        .update(productos)
        .set({ stock: sql`${productos.stock} - ${cantidad}` })
        .where(
          and(
            eq(productos.id, productoId),
            eq(productos.localId, localId),
            eq(productos.activo, true),
            sql`${productos.stock} >= ${cantidad}`,
          ),
        )
        .returning({
          // La factura guarda el NOMBRE COMPLETO ("Creed Aventus · EDP 100 ml · Hombre") como copia
          nombre: productos.nombreCompleto,
          precio: productos.precio,
          stock: productos.stock,
          marcaId: productos.marcaId,
          tipo: productos.tipo,
          genero: productos.genero,
          publico: productos.publico,
          contenidoMl: productos.contenidoMl,
          concentracion: productos.concentracion,
          categoria: productos.categoria,
        });

      if (!actualizado) {
        const producto = await tx.query.productos.findFirst({
          where: and(eq(productos.id, productoId), eq(productos.localId, localId)),
        });
        if (!producto || !producto.activo) throw new ApiError(404, "Uno de los productos ya no existe en el inventario.");
        throw new ApiError(
          409,
          producto.stock === 0
            ? `No hay stock de "${producto.nombre}". No se puede vender.`
            : `Stock insuficiente de "${producto.nombre}": solo quedan ${producto.stock} unidades.`,
        );
      }
      const { nombre, precio, stock, ...clasificacion } = actualizado;
      lineas.push({ productoId, nombre, precio, cantidad, stockResultante: stock, clasificacion });
    }

    /* 3. Totales (el precio SIEMPRE se toma del inventario, nunca del navegador) */
    const subtotal = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
    const total = subtotal + datos.adicional - datos.descuento;
    if (total < 0) throw new ApiError(400, "El descuento no puede ser mayor que el valor de la factura.");
    if (datos.tipo === "CREDITO" && total === 0) throw new ApiError(400, "Un crédito debe tener un valor mayor que cero.");

    /* Medio de pago (solo contado). El servidor calcula los valores con SU total. */
    const esCredito = datos.tipo === "CREDITO";
    if (!esCredito && !datos.medioPago) throw new ApiError(400, "Elige el medio de pago.");
    const pago = esCredito
      ? { medioPago: null, valorEfectivo: 0, valorTransferencia: 0 }
      : resolverPago({ ...datos, medioPago: datos.medioPago! }, total);

    /* 4. Número consecutivo del local (operación atómica) */
    const [local] = await tx
      .update(locales)
      .set({ consecutivoFactura: sql`${locales.consecutivoFactura} + 1` })
      .where(eq(locales.id, localId))
      .returning({ numero: locales.consecutivoFactura });

    const ahora = new Date();

    const [factura] = await tx
      .insert(facturas)
      .values({
        numero: local.numero,
        tipo: datos.tipo,
        estado: esCredito ? "PENDIENTE" : "COMPLETADA",
        localId,
        usuarioId: vendedor.id,
        vendedorNombre: vendedor.nombre,
        clienteId: cliente.id,
        clienteIdentificacion: cliente.identificacion,
        clienteNombre: cliente.nombre,
        clienteNombreBusqueda: normalizarTexto(cliente.nombre),
        clienteTelefono: cliente.telefono,
        clienteDireccion: cliente.direccion,
        clienteSector: cliente.sector,
        subtotal,
        adicional: datos.adicional,
        descuento: datos.descuento,
        total,
        saldo: esCredito ? total : 0,
        ...pago,
        notas: datos.notas || null,
        completadaEn: esCredito ? null : ahora,
      })
      .returning({ id: facturas.id });

    /* Copia de la clasificación de cada producto (con el NOMBRE de la marca), para que el historial no cambie */
    const idsMarca = [...new Set(lineas.map((l) => l.clasificacion.marcaId).filter((id): id is string => id !== null))];
    const nombresMarca = new Map(
      idsMarca.length
        ? (await tx.select({ id: marcas.id, nombre: marcas.nombre }).from(marcas).where(inArray(marcas.id, idsMarca))).map((m) => [m.id, m.nombre])
        : [],
    );

    await tx.insert(facturaItems).values(
      lineas.map(({ clasificacion: c, stockResultante: _stock, ...l }) => ({
        facturaId: factura.id,
        productoId: l.productoId,
        nombreProducto: l.nombre,
        precioUnitario: l.precio,
        cantidad: l.cantidad,
        subtotal: l.precio * l.cantidad,
        marcaNombre: c.marcaId ? (nombresMarca.get(c.marcaId) ?? null) : null,
        tipo: c.tipo,
        genero: c.genero,
        publico: c.publico,
        contenidoMl: c.contenidoMl,
        concentracion: c.concentracion,
        categoria: c.categoria,
      })),
    );

    /* Trazabilidad: un movimiento VENTA por producto, en esta misma transacción */
    await registrarMovimientos(
      tx,
      lineas.map((l) => ({
        localId,
        productoId: l.productoId,
        tipo: "VENTA" as const,
        cantidad: -l.cantidad,
        stockResultante: l.stockResultante,
        autor: vendedor,
        facturaId: factura.id,
        nota: `Factura #${local.numero}`,
      })),
    );

    /* 6. Cuotas: el valor se reparte en partes iguales; la última absorbe la diferencia de redondeo */
    if (esCredito && datos.cuotas?.length) {
      const fechas = datos.cuotas.map((c) => new Date(c.fechaVencimiento)).sort((a, b) => a.getTime() - b.getTime());
      const n = fechas.length;
      const base = Math.floor(total / n);
      await tx.insert(cuotas).values(
        fechas.map((f, i) => ({
          facturaId: factura.id,
          numero: i + 1,
          fechaVencimiento: f,
          valor: i === n - 1 ? total - base * (n - 1) : base,
        })),
      );
    }

    return factura.id;
  });
}

/* ------------------------------- Consultas ------------------------------- */

export async function listarFacturas(
  localId: string,
  filtros: { estado?: string; tipo?: string; texto?: string; pagina?: number },
): Promise<{ facturas: FacturaResumen[]; hayMas: boolean }> {
  const POR_PAGINA = 30;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const condiciones: SQL[] = [eq(facturas.localId, localId)];

  // "ANULADA" muestra solo las ventas eliminadas; cualquier otro filtro (también "Todas") las excluye
  condiciones.push(eq(facturas.anulada, filtros.estado === "ANULADA"));
  if (filtros.estado === "PENDIENTE" || filtros.estado === "COMPLETADA") condiciones.push(eq(facturas.estado, filtros.estado));
  if (filtros.tipo === "NORMAL" || filtros.tipo === "CREDITO") condiciones.push(eq(facturas.tipo, filtros.tipo));
  if (filtros.texto?.trim()) {
    const t = filtros.texto.trim();
    const parecido = `%${escaparLike(t)}%`;
    const opciones: SQL[] = [ilike(facturas.clienteNombre, parecido), ilike(facturas.clienteIdentificacion, parecido)];
    // Por nombre normalizado: "nino" encuentra "Niño"; cada palabra puede ir en cualquier orden
    const palabras = normalizarTexto(t).split(" ").filter(Boolean);
    if (palabras.length) opciones.push(and(...palabras.map((p) => ilike(facturas.clienteNombreBusqueda, `%${escaparLike(p)}%`)))!);
    if (/^\d+$/.test(t)) opciones.push(eq(facturas.numero, Number(t)));
    condiciones.push(or(...opciones)!);
  }

  const filas = await db
    .select(COLUMNAS_RESUMEN)
    .from(facturas)
    .where(and(...condiciones))
    // Las anuladas se ordenan por la fecha de anulación; las completadas, por la fecha en que se completaron
    .orderBy(
      desc(filtros.estado === "ANULADA" ? facturas.anuladaEn : sql`coalesce(${facturas.completadaEn}, ${facturas.creadoEn})`),
    )
    .limit(POR_PAGINA + 1)
    .offset((pagina - 1) * POR_PAGINA);

  return {
    facturas: filas.slice(0, POR_PAGINA).map(serializarResumen),
    hayMas: filas.length > POR_PAGINA,
  };
}

/** Columnas que necesita un FacturaResumen (se reutilizan en el historial y en el récord del cliente). */
export const COLUMNAS_RESUMEN = {
  id: facturas.id,
  numero: facturas.numero,
  tipo: facturas.tipo,
  estado: facturas.estado,
  clienteNombre: facturas.clienteNombre,
  clienteIdentificacion: facturas.clienteIdentificacion,
  total: facturas.total,
  saldo: facturas.saldo,
  medioPago: facturas.medioPago,
  valorEfectivo: facturas.valorEfectivo,
  valorTransferencia: facturas.valorTransferencia,
  creadoEn: facturas.creadoEn,
  completadaEn: facturas.completadaEn,
  anulada: facturas.anulada,
  anuladaEn: facturas.anuladaEn,
  anuladaPorNombre: facturas.anuladaPorNombre,
  motivoAnulacion: facturas.motivoAnulacion,
};

export async function obtenerFactura(localId: string, id: string): Promise<FacturaDetalle> {
  const f = await db.query.facturas.findFirst({
    where: and(eq(facturas.id, id), eq(facturas.localId, localId)),
    with: {
      local: { columns: { nombre: true, direccion: true, telefono: true } },
      items: true,
      cuotas: { orderBy: asc(cuotas.numero) },
      abonos: { orderBy: desc(abonos.creadoEn) },
    },
  });
  if (!f) throw new ApiError(404, "La factura no existe.");

  return {
    ...serializarResumen(f),
    clienteTelefono: f.clienteTelefono,
    clienteDireccion: f.clienteDireccion,
    clienteSector: f.clienteSector,
    vendedorNombre: f.vendedorNombre,
    subtotal: f.subtotal,
    adicional: f.adicional,
    descuento: f.descuento,
    notas: f.notas,
    local: f.local,
    items: f.items.map((i) => ({
      id: i.id,
      nombreProducto: i.nombreProducto,
      precioUnitario: i.precioUnitario,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      marcaNombre: i.marcaNombre,
      tipo: i.tipo,
      genero: i.genero,
      publico: i.publico,
      contenidoMl: i.contenidoMl,
      concentracion: i.concentracion,
      categoria: i.categoria,
    })),
    cuotas: f.cuotas.map((c) => ({
      id: c.id,
      numero: c.numero,
      fechaVencimiento: c.fechaVencimiento.toISOString(),
      valor: c.valor,
      valorPagado: c.valorPagado,
      estado: c.estado,
      pagadaEn: c.pagadaEn?.toISOString() ?? null,
    })),
    abonos: f.abonos.map((a) => ({
      id: a.id,
      valor: a.valor,
      medioPago: a.medioPago,
      valorEfectivo: a.valorEfectivo,
      valorTransferencia: a.valorTransferencia,
      nota: a.nota,
      creadoEn: a.creadoEn.toISOString(),
    })),
  };
}

export function serializarResumen(f: {
  id: string;
  numero: number;
  tipo: "NORMAL" | "CREDITO";
  estado: "PENDIENTE" | "COMPLETADA";
  clienteNombre: string;
  clienteIdentificacion: string;
  total: number;
  saldo: number;
  medioPago: MedioPago | null;
  valorEfectivo: number;
  valorTransferencia: number;
  creadoEn: Date;
  completadaEn: Date | null;
  anulada: boolean;
  anuladaEn: Date | null;
  anuladaPorNombre: string | null;
  motivoAnulacion: string | null;
}): FacturaResumen {
  return {
    id: f.id,
    numero: f.numero,
    tipo: f.tipo,
    estado: f.estado,
    clienteNombre: f.clienteNombre,
    clienteIdentificacion: f.clienteIdentificacion,
    total: f.total,
    saldo: f.saldo,
    medioPago: f.medioPago,
    valorEfectivo: f.valorEfectivo,
    valorTransferencia: f.valorTransferencia,
    creadoEn: f.creadoEn.toISOString(),
    completadaEn: f.completadaEn?.toISOString() ?? null,
    anulada: f.anulada,
    anuladaEn: f.anuladaEn?.toISOString() ?? null,
    anuladaPorNombre: f.anuladaPorNombre,
    motivoAnulacion: f.motivoAnulacion,
  };
}

/* ------------------------------- Anulación ------------------------------- */

/**
 * "Eliminar venta": anula la factura y devuelve los productos al inventario.
 * Todo ocurre en UNA transacción (si algo falla, no cambia nada):
 *  1. Bloquea la factura (SELECT ... FOR UPDATE): si dos personas la anulan a la vez,
 *     la segunda espera y luego ve que ya está anulada. Lo mismo con un abono simultáneo.
 *  2. Devuelve al stock la cantidad de cada producto y reactiva los que estaban ocultos.
 *     Si un producto ya no existe, se omite y se informa en el resultado.
 *     Cada devolución deja un movimiento de inventario AJUSTE (trazabilidad) con el número y el motivo.
 *  3. Anula las cuotas y los abonos (no se borran: quedan como parte de la venta anulada).
 *  4. Marca la factura como anulada con quién, cuándo y el motivo.
 */
export async function anularFactura(vendedor: VendedorSesion, facturaId: string, motivo: string): Promise<ResultadoAnulacion> {
  return db.transaction(async (tx) => {
    const [factura] = await tx
      .select({ id: facturas.id, numero: facturas.numero, anulada: facturas.anulada })
      .from(facturas)
      // Solo facturas del local del vendedor: una de otro local responde igual que una inexistente
      .where(and(eq(facturas.id, facturaId), eq(facturas.localId, vendedor.localId)))
      .for("update");
    if (!factura) throw new ApiError(404, "La venta no existe.");
    if (factura.anulada) throw new ApiError(409, "Esta venta ya fue eliminada.");

    /* Cantidades por producto (si el mismo producto aparece en dos líneas, se suman) */
    const items = await tx.select().from(facturaItems).where(eq(facturaItems.facturaId, facturaId));
    const porProducto = new Map<string, { nombre: string; cantidad: number }>();
    const omitidos: ResultadoAnulacion["omitidos"] = [];
    for (const item of items) {
      // El producto se borró del inventario: no hay a dónde devolverlo
      if (!item.productoId) {
        omitidos.push({ nombre: item.nombreProducto, cantidad: item.cantidad });
        continue;
      }
      const previo = porProducto.get(item.productoId);
      porProducto.set(item.productoId, { nombre: item.nombreProducto, cantidad: (previo?.cantidad ?? 0) + item.cantidad });
    }

    const devueltos: ResultadoAnulacion["devueltos"] = [];
    const movimientos: Parameters<typeof registrarMovimientos>[1] = [];
    for (const [productoId, linea] of porProducto) {
      const [producto] = await tx
        .update(productos)
        // Si el producto estaba oculto ("eliminado" con ventas), vuelve a quedar activo
        .set({ stock: sql`${productos.stock} + ${linea.cantidad}`, activo: true })
        .where(and(eq(productos.id, productoId), eq(productos.localId, vendedor.localId)))
        .returning({ nombre: productos.nombre, stock: productos.stock });
      if (!producto) {
        omitidos.push(linea);
        continue;
      }
      devueltos.push({ nombre: producto.nombre, cantidad: linea.cantidad });
      movimientos.push({
        localId: vendedor.localId,
        productoId,
        tipo: "AJUSTE",
        cantidad: linea.cantidad,
        stockResultante: producto.stock,
        autor: vendedor,
        facturaId,
        nota: `Venta eliminada (factura #${factura.numero}): ${motivo}`,
      });
    }
    /* Trazabilidad: el stock que regresa queda registrado, en esta misma transacción */
    await registrarMovimientos(tx, movimientos);

    /* Cuotas y abonos del crédito: se marcan como anulados (no se borran) */
    await tx.update(cuotas).set({ anulada: true }).where(eq(cuotas.facturaId, facturaId));
    const abonosAnulados = await tx
      .update(abonos)
      .set({ anulado: true })
      .where(and(eq(abonos.facturaId, facturaId), eq(abonos.anulado, false)))
      .returning({ valor: abonos.valor });

    await tx
      .update(facturas)
      .set({
        anulada: true,
        anuladaEn: new Date(),
        anuladaPorId: vendedor.id,
        anuladaPorNombre: vendedor.nombre,
        motivoAnulacion: motivo,
      })
      .where(eq(facturas.id, facturaId));

    return { devueltos, omitidos, abonosAnulados: abonosAnulados.reduce((acc, a) => acc + a.valor, 0) };
  });
}
