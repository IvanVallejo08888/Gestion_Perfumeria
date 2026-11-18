/**
 * Gastos empresariales de cada local y sus categorías.
 *  - El vendedor registra gastos y puede eliminar (anular) cualquier gasto de SU local, con un motivo.
 *  - El administrador puede eliminar (anular) gastos de cualquier local desde Reportes.
 *  - Un gasto eliminado no se borra: queda con el motivo, quién y cuándo, y no suma en ningún total.
 *  - El administrador define las categorías y consulta los gastos de cada local.
 *  - Cada gasto guarda una copia del nombre de la categoría y del usuario:
 *    el historial no cambia si luego se renombran o se eliminan.
 */
import "server-only";
import { and, asc, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categoriasGasto, gastos } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import { hoyColombia, rangoDias } from "@/lib/formato";
import type { GastoFila, ListaGastos, MedioPagoGasto } from "@/tipos";
import { obtenerLocal } from "./locales";
import { clasificarNombres, ordenarPorNombre } from "./sectores";

/* ------------------------------- Categorías ------------------------------- */

export async function listarCategorias(localId: string, opciones: { soloActivas?: boolean } = {}) {
  const lista = await db
    .select({ id: categoriasGasto.id, nombre: categoriasGasto.nombre, activo: categoriasGasto.activo })
    .from(categoriasGasto)
    .where(and(eq(categoriasGasto.localId, localId), opciones.soloActivas ? eq(categoriasGasto.activo, true) : undefined));
  return ordenarPorNombre(lista);
}

export async function agregarCategorias(localId: string, nombres: string[]) {
  await obtenerLocal(localId);
  return db.transaction(async (tx) => {
    const existentes = await tx.select().from(categoriasGasto).where(eq(categoriasGasto.localId, localId));
    const { nuevos, reactivar, repetidos } = clasificarNombres(nombres, existentes);
    if (nuevos.length) await tx.insert(categoriasGasto).values(nuevos.map((nombre) => ({ localId, nombre })));
    for (const id of reactivar) await tx.update(categoriasGasto).set({ activo: true }).where(eq(categoriasGasto.id, id));
    return { agregados: nuevos.length, reactivados: reactivar.length, repetidos };
  });
}

export async function editarCategoria(id: string, datos: { nombre?: string; activo?: boolean }) {
  const categoria = await db.query.categoriasGasto.findFirst({ where: eq(categoriasGasto.id, id) });
  if (!categoria) throw new ApiError(404, "La categoría no existe.");
  if (datos.nombre !== undefined) {
    const repetida = await db.query.categoriasGasto.findFirst({
      where: and(eq(categoriasGasto.localId, categoria.localId), sql`lower(${categoriasGasto.nombre}) = lower(${datos.nombre})`),
    });
    if (repetida && repetida.id !== id) throw new ApiError(409, `Ya existe la categoría «${repetida.nombre}» en este local.`);
  }
  await db.update(categoriasGasto).set(datos).where(eq(categoriasGasto.id, id));
}

/* --------------------------------- Gastos --------------------------------- */

export interface DatosGasto {
  categoriaId: string;
  valor: number;
  medioPago: MedioPagoGasto;
  fecha: string;
  descripcion?: string;
}

export async function crearGasto(vendedor: VendedorSesion, datos: DatosGasto) {
  if (datos.fecha > hoyColombia()) throw new ApiError(400, "La fecha del gasto no puede ser futura.");

  const categoria = await db.query.categoriasGasto.findFirst({
    where: and(
      eq(categoriasGasto.id, datos.categoriaId),
      eq(categoriasGasto.localId, vendedor.localId),
      eq(categoriasGasto.activo, true),
    ),
  });
  if (!categoria) throw new ApiError(400, "La categoría elegida no existe o está desactivada en este local.");

  await db.insert(gastos).values({
    localId: vendedor.localId,
    usuarioId: vendedor.id,
    usuarioNombre: vendedor.nombre,
    categoriaId: categoria.id,
    categoriaNombre: categoria.nombre,
    descripcion: datos.descripcion || null,
    valor: datos.valor,
    medioPago: datos.medioPago,
    fecha: datos.fecha,
  });
}

/** Convierte una fila de la tabla en el formato que recibe la pantalla. */
function aFila(g: typeof gastos.$inferSelect): GastoFila {
  return {
    id: g.id,
    categoriaNombre: g.categoriaNombre,
    descripcion: g.descripcion,
    valor: g.valor,
    medioPago: g.medioPago,
    fecha: g.fecha,
    usuarioNombre: g.usuarioNombre,
    anulado: g.anulado,
    anuladoEn: g.anuladoEn?.toISOString() ?? null,
    anuladoPorNombre: g.anuladoPorNombre,
    motivoAnulacion: g.motivoAnulacion,
  };
}

/**
 * Gastos de un local en un periodo.
 *  - Por defecto devuelve los gastos vigentes; con estado "eliminados", solo los anulados.
 *  - Los totales (del mes y por medio de pago) SIEMPRE se calculan en SQL con los gastos
 *    vigentes: un gasto eliminado nunca suma, aunque se esté viendo el filtro "Eliminados".
 */
export async function listarGastos(
  localId: string,
  filtros: { anio: number; mes?: number; categoriaId?: string; estado?: "eliminados" },
): Promise<ListaGastos> {
  const { desde, hasta } = rangoDias(filtros.anio, filtros.mes);
  const base: SQL[] = [eq(gastos.localId, localId), gte(gastos.fecha, desde), lt(gastos.fecha, hasta)];
  if (filtros.categoriaId) base.push(eq(gastos.categoriaId, filtros.categoriaId));
  const verEliminados = filtros.estado === "eliminados";

  const [filas, [totales]] = await Promise.all([
    db
      .select()
      .from(gastos)
      .where(and(...base, eq(gastos.anulado, verEliminados)))
      .orderBy(verEliminados ? desc(gastos.anuladoEn) : desc(gastos.fecha), desc(gastos.creadoEn)),
    db
      .select({
        total: sql<number>`coalesce(sum(${gastos.valor}), 0)::int`,
        totalEfectivo: sql<number>`coalesce(sum(${gastos.valor}) filter (where ${gastos.medioPago} = 'EFECTIVO'), 0)::int`,
        totalTransferencia: sql<number>`coalesce(sum(${gastos.valor}) filter (where ${gastos.medioPago} = 'TRANSFERENCIA'), 0)::int`,
      })
      .from(gastos)
      .where(and(...base, eq(gastos.anulado, false))),
  ]);

  return { gastos: filas.map(aFila), ...totales };
}

/**
 * "Eliminar gasto": lo ANULA (no lo borra) para que quede registro de quién, cuándo y por qué.
 *  - localId: el local del vendedor (solo puede anular gastos de su local).
 *    El administrador envía null y puede anular gastos de cualquier local.
 *  - La actualización solo aplica si el gasto sigue vigente: si dos personas lo eliminan
 *    a la vez, solo una lo logra y la otra recibe "Este gasto ya fue eliminado".
 */
export async function anularGasto(
  usuario: { id: string; nombre: string },
  gastoId: string,
  motivo: string,
  localId: string | null,
): Promise<GastoFila> {
  const delLocal = localId ? eq(gastos.localId, localId) : undefined;
  const gasto = await db.query.gastos.findFirst({ where: and(eq(gastos.id, gastoId), delLocal) });
  if (!gasto) throw new ApiError(404, "El gasto no existe.");
  if (gasto.anulado) throw new ApiError(409, "Este gasto ya fue eliminado.");

  const [anulado] = await db
    .update(gastos)
    .set({ anulado: true, anuladoEn: new Date(), anuladoPorId: usuario.id, anuladoPorNombre: usuario.nombre, motivoAnulacion: motivo })
    .where(and(eq(gastos.id, gastoId), eq(gastos.anulado, false), delLocal))
    .returning();
  if (!anulado) throw new ApiError(409, "Este gasto ya fue eliminado.");
  return aFila(anulado);
}

/**
 * Gastos de un periodo para el Excel, del más antiguo al más reciente.
 * Por defecto solo los vigentes; con eliminados = true, solo los anulados (hoja "Gastos eliminados").
 */
export async function gastosDelPeriodo(localId: string, anio: number, mes?: number, eliminados = false) {
  const { desde, hasta } = rangoDias(anio, mes);
  return db
    .select()
    .from(gastos)
    .where(and(eq(gastos.localId, localId), eq(gastos.anulado, eliminados), gte(gastos.fecha, desde), lt(gastos.fecha, hasta)))
    .orderBy(asc(gastos.fecha), asc(gastos.creadoEn));
}
