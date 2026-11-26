/**
 * Deudas del negocio (gastos a crédito): plan de pagos, pagos, anulaciones y cambios de fecha.
 *
 * Regla contable (ver src/lib/deudas.ts y el README):
 *  - Registrar el gasto a crédito NO saca dinero de la caja: solo nace la deuda con sus cuotas.
 *  - Cada pago SÍ sale de la caja del día del pago, con su medio (efectivo, transferencia o mixto).
 *
 * Concurrencia: toda operación que cambia el saldo bloquea la fila de la deuda (SELECT … FOR UPDATE).
 * Así dos pagos simultáneos, o un pago y la anulación del gasto, nunca dejan cifras que no cuadran.
 *
 * Seguridad: todas las consultas filtran por el local del vendedor. Una deuda de otro local responde 404.
 */
import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db, type Transaccion } from "@/db";
import { deudaCuotas, deudaPagos, deudas, gastos, proveedores } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import {
  aplicarPagosACuotas,
  calcularResumenMedioPago,
  validarPagoDeuda,
  validarPlanCuotas,
  type EstadoDeuda,
} from "@/lib/deudas";
import { hoyColombia } from "@/lib/formato";
import type { DeudaCuotaFila, DeudaDetalle, DeudaPagoFila, DeudaResumen, GastoDeudaInfo, ListaDeudas } from "@/tipos";
import { resolverPago, type DatosPago } from "./pagos";

type Conexion = typeof db | Transaccion;

/* --------------------------------- Crear --------------------------------- */

export interface DatosDeudaNueva {
  acreedor: string;
  descripcion?: string;
  cuotas: { fechaVencimiento: string; valor: number }[];
}

/**
 * Crea la deuda y sus cuotas para un gasto a crédito que se acaba de insertar.
 * Se llama DENTRO de la transacción de crearGasto: o se guardan gasto, deuda y cuotas, o nada.
 */
export async function crearDeudaEnTx(
  tx: Transaccion,
  vendedor: VendedorSesion,
  gasto: { id: string; valor: number },
  datos: DatosDeudaNueva,
): Promise<string> {
  // El servidor vuelve a validar el plan: nunca confía en la suma que hizo el navegador
  const error = validarPlanCuotas(gasto.valor, datos.cuotas.map((c) => c.valor));
  if (error) throw new ApiError(400, error);
  const acreedor = datos.acreedor.trim();
  if (acreedor.length < 2) throw new ApiError(400, "Escribe a quién le debes.");

  const [deuda] = await tx
    .insert(deudas)
    .values({
      localId: vendedor.localId,
      gastoId: gasto.id,
      acreedor,
      descripcion: datos.descripcion || null,
      valorTotal: gasto.valor,
      saldo: gasto.valor,
      estado: "PENDIENTE",
      creadoPorId: vendedor.id,
      creadoPorNombre: vendedor.nombre,
    })
    .returning({ id: deudas.id });

  // Las cuotas se guardan en orden de fecha y se numeran 1, 2, 3…
  const ordenadas = [...datos.cuotas].sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime());
  await tx.insert(deudaCuotas).values(
    ordenadas.map((c, i) => ({ deudaId: deuda.id, numero: i + 1, fechaVencimiento: new Date(c.fechaVencimiento), valor: c.valor })),
  );
  return deuda.id;
}

/* ------------------------------- Consultas ------------------------------- */

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Columnas de la deuda + datos de su gasto de origen (categoría, si es personal y el día). */
const columnasDeuda = {
  id: deudas.id,
  gastoId: deudas.gastoId,
  acreedor: deudas.acreedor,
  descripcion: deudas.descripcion,
  valorTotal: deudas.valorTotal,
  saldo: deudas.saldo,
  estado: deudas.estado,
  pagadaEn: deudas.pagadaEn,
  resumenMedioPago: deudas.resumenMedioPago,
  creadoPorNombre: deudas.creadoPorNombre,
  creadoEn: deudas.creadoEn,
  anuladaEn: deudas.anuladaEn,
  anuladaPorNombre: deudas.anuladaPorNombre,
  motivoAnulacion: deudas.motivoAnulacion,
  categoriaNombre: gastos.categoriaNombre,
  personal: gastos.personal,
  fecha: gastos.fecha,
};

type FilaDeuda = Awaited<ReturnType<typeof consultarDeudas>>[number];

function consultarDeudas(cx: Conexion, condicion: SQL | undefined) {
  return cx.select(columnasDeuda).from(deudas).innerJoin(gastos, eq(gastos.id, deudas.gastoId)).where(condicion);
}

function aFilaCuota(c: typeof deudaCuotas.$inferSelect): DeudaCuotaFila {
  return {
    id: c.id,
    numero: c.numero,
    fechaVencimiento: c.fechaVencimiento.toISOString(),
    valor: c.valor,
    valorPagado: c.valorPagado,
    estado: c.estado,
    pagadaEn: iso(c.pagadaEn),
  };
}

function aFilaPago(p: typeof deudaPagos.$inferSelect): DeudaPagoFila {
  return {
    id: p.id,
    fecha: p.fecha.toISOString(),
    valor: p.valor,
    medioPago: p.medioPago,
    valorEfectivo: p.valorEfectivo,
    valorTransferencia: p.valorTransferencia,
    nota: p.nota,
    usuarioNombre: p.usuarioNombre,
    anulado: p.anulado,
    anuladoEn: iso(p.anuladoEn),
    anuladoPorNombre: p.anuladoPorNombre,
    motivoAnulacion: p.motivoAnulacion,
  };
}

function aResumen(d: FilaDeuda, cuotas: (typeof deudaCuotas.$inferSelect)[]): DeudaResumen {
  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero);
  // En una deuda anulada no hay "próxima cuota": ya no se paga
  const proxima = d.estado === "PENDIENTE" ? ordenadas.find((c) => c.estado === "PENDIENTE") : undefined;
  return {
    id: d.id,
    gastoId: d.gastoId,
    acreedor: d.acreedor,
    descripcion: d.descripcion,
    categoriaNombre: d.categoriaNombre,
    personal: d.personal,
    fecha: d.fecha,
    valorTotal: d.valorTotal,
    pagado: d.valorTotal - d.saldo,
    saldo: d.saldo,
    estado: d.estado,
    totalCuotas: ordenadas.length,
    cuotasPagadas: ordenadas.filter((c) => c.estado === "PAGADA").length,
    proximaCuota: proxima
      ? { numero: proxima.numero, fechaVencimiento: proxima.fechaVencimiento.toISOString(), pendiente: proxima.valor - proxima.valorPagado }
      : null,
    pagadaEn: iso(d.pagadaEn),
    resumenMedioPago: d.resumenMedioPago,
  };
}

/** Lista de deudas del local por estado, con el resumen de las pendientes (arriba de la pestaña). */
export async function listarDeudas(localId: string, estado: EstadoDeuda): Promise<ListaDeudas> {
  const filas = await consultarDeudas(db, and(eq(deudas.localId, localId), eq(deudas.estado, estado)))
    .orderBy(desc(deudas.creadoEn))
    .limit(300);
  const cuotas = filas.length ? await db.select().from(deudaCuotas).where(inArray(deudaCuotas.deudaId, filas.map((f) => f.id))) : [];
  const lista = filas.map((f) => aResumen(f, cuotas.filter((c) => c.deudaId === f.id)));

  // Pendientes: primero la que hay que pagar antes. Pagadas: la más reciente primero.
  if (estado === "PENDIENTE") {
    lista.sort((a, b) => (a.proximaCuota?.fechaVencimiento ?? "9").localeCompare(b.proximaCuota?.fechaVencimiento ?? "9"));
  } else if (estado === "PAGADA") {
    lista.sort((a, b) => (b.pagadaEn ?? "").localeCompare(a.pagadaEn ?? ""));
  }

  return { deudas: lista, resumen: await resumenPendientes(localId) };
}

/** Total adeudado, cuotas vencidas y próximo pago de las deudas PENDIENTES del local. */
async function resumenPendientes(localId: string): Promise<ListaDeudas["resumen"]> {
  const pendientes = and(eq(deudas.localId, localId), eq(deudas.estado, "PENDIENTE"));
  const [[totales], [vencidas], [proxima]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${deudas.saldo}), 0)::int`, cantidad: sql<number>`count(*)::int` })
      .from(deudas)
      .where(pendientes),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deudaCuotas)
      .innerJoin(deudas, eq(deudas.id, deudaCuotas.deudaId))
      .where(and(pendientes, eq(deudaCuotas.estado, "PENDIENTE"), lt(deudaCuotas.fechaVencimiento, new Date()))),
    db
      .select({
        deudaId: deudas.id,
        acreedor: deudas.acreedor,
        fechaVencimiento: deudaCuotas.fechaVencimiento,
        valor: sql<number>`(${deudaCuotas.valor} - ${deudaCuotas.valorPagado})::int`,
      })
      .from(deudaCuotas)
      .innerJoin(deudas, eq(deudas.id, deudaCuotas.deudaId))
      .where(and(pendientes, eq(deudaCuotas.estado, "PENDIENTE")))
      .orderBy(asc(deudaCuotas.fechaVencimiento))
      .limit(1),
  ]);
  return {
    totalAdeudado: totales?.total ?? 0,
    cantidadPendientes: totales?.cantidad ?? 0,
    cuotasVencidas: vencidas?.n ?? 0,
    proximoPago: proxima ? { ...proxima, fechaVencimiento: proxima.fechaVencimiento.toISOString() } : null,
  };
}

/** Detalle de una deuda: cuotas, todos los pagos (también los anulados) y el cierre. 404 si no es del local. */
export async function obtenerDeuda(localId: string, id: string, cx: Conexion = db): Promise<DeudaDetalle> {
  const [fila] = await consultarDeudas(cx, and(eq(deudas.id, id), eq(deudas.localId, localId)));
  if (!fila) throw new ApiError(404, "La deuda no existe.");
  const [cuotas, pagos] = await Promise.all([
    cx.select().from(deudaCuotas).where(eq(deudaCuotas.deudaId, id)).orderBy(asc(deudaCuotas.numero)),
    cx.select().from(deudaPagos).where(eq(deudaPagos.deudaId, id)).orderBy(asc(deudaPagos.fecha), asc(deudaPagos.creadoEn)),
  ]);
  const vigentes = pagos.filter((p) => !p.anulado);
  return {
    ...aResumen(fila, cuotas),
    cuotas: cuotas.map(aFilaCuota),
    pagos: pagos.map(aFilaPago),
    totalEfectivo: vigentes.reduce((a, p) => a + p.valorEfectivo, 0),
    totalTransferencia: vigentes.reduce((a, p) => a + p.valorTransferencia, 0),
    creadoPorNombre: fila.creadoPorNombre,
    creadoEn: fila.creadoEn.toISOString(),
    anuladaEn: iso(fila.anuladaEn),
    anuladaPorNombre: fila.anuladaPorNombre,
    motivoAnulacion: fila.motivoAnulacion,
  };
}

/**
 * Sugerencias para «¿A quién le debes?»: acreedores ya usados en el local y proveedores activos,
 * sin repetir (sin importar mayúsculas), en orden alfabético.
 */
export async function sugerenciasAcreedores(localId: string): Promise<string[]> {
  const [usados, deProveedores] = await Promise.all([
    db.selectDistinct({ nombre: deudas.acreedor }).from(deudas).where(eq(deudas.localId, localId)).limit(300),
    db
      .select({ nombre: proveedores.nombre })
      .from(proveedores)
      .where(and(eq(proveedores.localId, localId), eq(proveedores.activo, true)))
      .limit(300),
  ]);
  const unicos = new Map<string, string>();
  for (const { nombre } of [...usados, ...deProveedores]) {
    const clave = nombre.trim().toLocaleLowerCase("es");
    if (clave && !unicos.has(clave)) unicos.set(clave, nombre.trim());
  }
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** Datos de la deuda de cada gasto a crédito (para la lista de gastos y la confirmación de anularlo). */
export async function deudasDeGastos(gastoIds: string[]): Promise<Map<string, GastoDeudaInfo>> {
  if (gastoIds.length === 0) return new Map();
  const filas = await db
    .select({
      gastoId: deudas.gastoId,
      id: deudas.id,
      acreedor: deudas.acreedor,
      estado: deudas.estado,
      saldo: deudas.saldo,
      pagosVigentes: sql<number>`(select count(*)::int from ${deudaPagos} p where p.deuda_id = ${deudas.id} and not p.anulado)`,
      valorPagos: sql<number>`(select coalesce(sum(p.valor), 0)::int from ${deudaPagos} p where p.deuda_id = ${deudas.id} and not p.anulado)`,
    })
    .from(deudas)
    .where(inArray(deudas.gastoId, gastoIds));
  return new Map(filas.map(({ gastoId, ...info }) => [gastoId, info]));
}

/**
 * Pagos de deudas VIGENTES de un local en un rango de instantes [inicio, fin), con la categoría de su gasto.
 * Es el dinero de las deudas que salió de la caja en ese periodo (se suma a los gastos).
 */
export function pagosDeudasEnRango(localId: string, inicio: Date, fin: Date, filtros: { categoriaId?: string } = {}) {
  return db
    .select({
      id: deudaPagos.id,
      fecha: deudaPagos.fecha,
      valor: deudaPagos.valor,
      medioPago: deudaPagos.medioPago,
      valorEfectivo: deudaPagos.valorEfectivo,
      valorTransferencia: deudaPagos.valorTransferencia,
      usuarioNombre: deudaPagos.usuarioNombre,
      nota: deudaPagos.nota,
      acreedor: deudas.acreedor,
      personal: gastos.personal,
      categoriaNombre: gastos.categoriaNombre,
    })
    .from(deudaPagos)
    .innerJoin(deudas, eq(deudas.id, deudaPagos.deudaId))
    .innerJoin(gastos, eq(gastos.id, deudas.gastoId))
    .where(
      and(
        eq(deudaPagos.localId, localId),
        eq(deudaPagos.anulado, false),
        gte(deudaPagos.fecha, inicio),
        lt(deudaPagos.fecha, fin),
        filtros.categoriaId ? eq(gastos.categoriaId, filtros.categoriaId) : undefined,
      ),
    )
    .orderBy(asc(deudaPagos.fecha));
}

/* ------------------------- Recalcular la deuda ------------------------- */

/**
 * Deja las cuotas, el saldo, el estado y la forma de pago final cuadrados con los pagos VIGENTES.
 * Se usa después de pagar y de anular un pago (la deuda ya debe estar bloqueada con FOR UPDATE).
 */
async function recalcularDeuda(tx: Transaccion, deuda: { id: string; valorTotal: number }) {
  const [cuotas, pagos] = await Promise.all([
    tx.select().from(deudaCuotas).where(eq(deudaCuotas.deudaId, deuda.id)),
    tx.select().from(deudaPagos).where(and(eq(deudaPagos.deudaId, deuda.id), eq(deudaPagos.anulado, false))),
  ]);
  const calculadas = aplicarPagosACuotas(cuotas, pagos);
  for (const c of calculadas) {
    const actual = cuotas.find((x) => x.id === c.id)!;
    if (actual.valorPagado !== c.valorPagado || actual.estado !== c.estado || actual.pagadaEn?.getTime() !== c.pagadaEn?.getTime()) {
      await tx
        .update(deudaCuotas)
        .set({ valorPagado: c.valorPagado, estado: c.estado, pagadaEn: c.pagadaEn })
        .where(eq(deudaCuotas.id, c.id));
    }
  }

  const pagado = pagos.reduce((a, p) => a + p.valor, 0);
  const saldo = deuda.valorTotal - pagado;
  const pagada = saldo === 0;
  // La deuda queda pagada el día del ÚLTIMO pago (puede ser un pago olvidado con fecha anterior)
  const ultimoPago = pagos.reduce<Date | null>((max, p) => (!max || p.fecha > max ? p.fecha : max), null);
  await tx
    .update(deudas)
    .set({
      saldo,
      estado: pagada ? "PAGADA" : "PENDIENTE",
      pagadaEn: pagada ? ultimoPago : null,
      resumenMedioPago: pagada ? (calcularResumenMedioPago(pagos)?.medio ?? null) : null,
    })
    .where(eq(deudas.id, deuda.id));
  return { saldo, pagada };
}

/** Bloquea la deuda del local (FOR UPDATE) y la devuelve con el día de su gasto de origen. 404 si no existe. */
async function bloquearDeuda(tx: Transaccion, localId: string, deudaId: string) {
  const [deuda] = await tx.select().from(deudas).where(and(eq(deudas.id, deudaId), eq(deudas.localId, localId))).for("update");
  if (!deuda) throw new ApiError(404, "La deuda no existe.");
  const [gasto] = await tx.select({ fecha: gastos.fecha }).from(gastos).where(eq(gastos.id, deuda.gastoId));
  return { ...deuda, fechaGasto: gasto.fecha };
}

/* --------------------------------- Pagar --------------------------------- */

export interface DatosPagoDeuda extends DatosPago {
  valor: number;
  /** ISO. Sin fecha = ahora. */
  fecha?: string;
  nota?: string;
}

/** Tolerancia para la hora del navegador al registrar un pago "ahora" (relojes un poco adelantados). */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/**
 * Registra un pago a una deuda (todo en una transacción, con la deuda bloqueada):
 * valida el valor contra el saldo, guarda el pago con su medio, lo aplica a las cuotas en orden
 * y actualiza el saldo. Si el saldo llega a 0, la deuda queda PAGADA con su forma de pago final.
 */
export async function registrarPagoDeuda(vendedor: VendedorSesion, deudaId: string, datos: DatosPagoDeuda) {
  // El medio se valida sobre el valor del pago (en Mixto, el efectivo = valor − transferencia)
  const reparto = resolverPago(datos, datos.valor);
  const ahora = new Date();
  const fecha = datos.fecha ? new Date(datos.fecha) : ahora;
  if (fecha.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) throw new ApiError(400, "La fecha del pago no puede ser futura.");

  const resultado = await db.transaction(async (tx) => {
    const deuda = await bloquearDeuda(tx, vendedor.localId, deudaId);
    if (deuda.estado === "ANULADA") throw new ApiError(400, "Esta deuda fue anulada: no se le pueden registrar pagos.");
    const error = validarPagoDeuda(deuda.saldo, datos.valor);
    if (error) throw new ApiError(400, error);
    if (hoyColombia(fecha) < deuda.fechaGasto) {
      throw new ApiError(400, "La fecha del pago no puede ser anterior al día en que se adquirió la deuda.");
    }

    await tx.insert(deudaPagos).values({
      deudaId,
      localId: vendedor.localId,
      fecha,
      valor: datos.valor,
      ...reparto,
      nota: datos.nota || null,
      usuarioId: vendedor.id,
      usuarioNombre: vendedor.nombre,
    });
    return recalcularDeuda(tx, deuda);
  });

  return { deuda: await obtenerDeuda(vendedor.localId, deudaId), quedoPagada: resultado.pagada };
}

/* ------------------------------ Anular un pago ------------------------------ */

/**
 * Anula un pago hecho por error (con motivo). El pago se conserva marcado, deja de contar en la caja,
 * los gastos y la utilidad, y las cuotas y el saldo se recalculan. Si la deuda estaba PAGADA vuelve a PENDIENTE.
 */
export async function anularPagoDeuda(usuario: { id: string; nombre: string }, localId: string, pagoId: string, motivo: string) {
  const [pago] = await db
    .select({ deudaId: deudaPagos.deudaId })
    .from(deudaPagos)
    .where(and(eq(deudaPagos.id, pagoId), eq(deudaPagos.localId, localId)));
  if (!pago) throw new ApiError(404, "El pago no existe.");

  await db.transaction(async (tx) => {
    const deuda = await bloquearDeuda(tx, localId, pago.deudaId);
    const [anulado] = await tx
      .update(deudaPagos)
      .set({ anulado: true, anuladoEn: new Date(), anuladoPorId: usuario.id, anuladoPorNombre: usuario.nombre, motivoAnulacion: motivo })
      .where(and(eq(deudaPagos.id, pagoId), eq(deudaPagos.anulado, false)))
      .returning({ id: deudaPagos.id });
    if (!anulado) throw new ApiError(409, "Este pago ya fue anulado.");
    await recalcularDeuda(tx, deuda);
  });

  return obtenerDeuda(localId, pago.deudaId);
}

/* --------------------------- Cambiar la fecha de una cuota --------------------------- */

/** Cambia la fecha y hora de pago de una cuota pendiente de una deuda pendiente. */
export async function cambiarFechaCuotaDeuda(localId: string, cuotaId: string, fechaVencimiento: Date) {
  const [cuota] = await db
    .select({ estado: deudaCuotas.estado, deudaId: deudaCuotas.deudaId, estadoDeuda: deudas.estado })
    .from(deudaCuotas)
    .innerJoin(deudas, eq(deudas.id, deudaCuotas.deudaId))
    .where(and(eq(deudaCuotas.id, cuotaId), eq(deudas.localId, localId)));
  if (!cuota) throw new ApiError(404, "La cuota no existe.");
  if (cuota.estadoDeuda === "ANULADA") throw new ApiError(400, "Esta deuda fue anulada: ya no se pueden cambiar sus fechas.");
  if (cuota.estado === "PAGADA") throw new ApiError(400, "No se puede cambiar la fecha de una cuota ya pagada.");
  // Solo si sigue pendiente (por si la pagaron mientras tanto)
  const [actualizada] = await db
    .update(deudaCuotas)
    .set({ fechaVencimiento })
    .where(and(eq(deudaCuotas.id, cuotaId), eq(deudaCuotas.estado, "PENDIENTE")))
    .returning({ id: deudaCuotas.id });
  if (!actualizada) throw new ApiError(409, "La cuota se acaba de pagar: ya no se puede cambiar su fecha.");
  return obtenerDeuda(localId, cuota.deudaId);
}

/* --------------------- Anular el gasto de origen (deuda) --------------------- */

/**
 * Se llama dentro de la transacción de anularGasto cuando el gasto es a crédito.
 * Regla (la más segura): si la deuda tiene pagos vigentes NO se anula; hay que anular antes cada pago,
 * con su motivo, porque cada uno ya salió de la caja de un día concreto.
 * Sin pagos vigentes: la deuda pasa a ANULADA (deja de avisar y de contar como saldo por pagar).
 */
export async function anularDeudaDeGasto(tx: Transaccion, gastoId: string, usuario: { id: string; nombre: string }, motivo: string) {
  const [deuda] = await tx.select().from(deudas).where(eq(deudas.gastoId, gastoId)).for("update");
  if (!deuda) return; // gasto a crédito sin deuda (no debería pasar): se anula solo el gasto
  const [vigentes] = await tx
    .select({ n: sql<number>`count(*)::int`, valor: sql<number>`coalesce(sum(${deudaPagos.valor}), 0)::int` })
    .from(deudaPagos)
    .where(and(eq(deudaPagos.deudaId, deuda.id), eq(deudaPagos.anulado, false)));
  if (vigentes.n > 0) {
    const pagos = vigentes.n === 1 ? "1 pago" : `${vigentes.n} pagos`;
    throw new ApiError(
      409,
      `Esta deuda con ${deuda.acreedor} tiene ${pagos} por $ ${vigentes.valor.toLocaleString("es-CO")}. Anula primero esos pagos en la pestaña «Deudas» y luego elimina el gasto.`,
    );
  }
  await tx
    .update(deudas)
    .set({ estado: "ANULADA", anuladaEn: new Date(), anuladaPorId: usuario.id, anuladaPorNombre: usuario.nombre, motivoAnulacion: motivo })
    .where(eq(deudas.id, deuda.id));
}

/* ------------------------------ Para el Excel ------------------------------ */

/**
 * Deudas para la hoja «Deudas» del Excel: las adquiridas en el periodo (días [desde, hasta), también
 * las pagadas y anuladas) y TODAS las que siguen pendientes hoy, aunque sean de antes.
 */
export async function deudasParaReporte(localId: string, desde: string, hasta: string): Promise<DeudaResumen[]> {
  const filas = await consultarDeudas(
    db,
    and(eq(deudas.localId, localId), or(and(gte(gastos.fecha, desde), lt(gastos.fecha, hasta)), eq(deudas.estado, "PENDIENTE"))),
  ).orderBy(asc(gastos.fecha), asc(deudas.creadoEn));
  const cuotas = filas.length ? await db.select().from(deudaCuotas).where(inArray(deudaCuotas.deudaId, filas.map((f) => f.id))) : [];
  return filas.map((f) => aResumen(f, cuotas.filter((c) => c.deudaId === f.id)));
}

/** Pagos de deudas de un periodo [inicio, fin) para la hoja «Pagos de deudas» (también los anulados, marcados). */
export function pagosDeudasParaReporte(localId: string, inicio: Date, fin: Date) {
  return db
    .select({
      fecha: deudaPagos.fecha,
      acreedor: deudas.acreedor,
      valor: deudaPagos.valor,
      medioPago: deudaPagos.medioPago,
      valorEfectivo: deudaPagos.valorEfectivo,
      valorTransferencia: deudaPagos.valorTransferencia,
      usuarioNombre: deudaPagos.usuarioNombre,
      nota: deudaPagos.nota,
      personal: gastos.personal,
      anulado: deudaPagos.anulado,
      motivoAnulacion: deudaPagos.motivoAnulacion,
    })
    .from(deudaPagos)
    .innerJoin(deudas, eq(deudas.id, deudaPagos.deudaId))
    .innerJoin(gastos, eq(gastos.id, deudas.gastoId))
    .where(and(eq(deudaPagos.localId, localId), gte(deudaPagos.fecha, inicio), lt(deudaPagos.fecha, fin)))
    .orderBy(asc(deudaPagos.fecha));
}

/* ------------------------- Deudas por pagar hoy ------------------------- */

/** Cantidad y saldo de las deudas pendientes HOY de un local (para estadísticas y Excel). */
export async function deudasPorPagarHoy(localId: string) {
  const [fila] = await db
    .select({ cantidad: sql<number>`count(*)::int`, saldo: sql<number>`coalesce(sum(${deudas.saldo}), 0)::int` })
    .from(deudas)
    .where(and(eq(deudas.localId, localId), eq(deudas.estado, "PENDIENTE")));
  return fila ?? { cantidad: 0, saldo: 0 };
}
