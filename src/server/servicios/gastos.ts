/**
 * Gastos empresariales de cada local y sus categorías.
 *  - El vendedor registra gastos y solo puede eliminar los suyos registrados hoy.
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

/** Solo quien registró el gasto puede eliminarlo, y solo el mismo día en que lo registró. */
const eliminable = (g: { usuarioId: string | null; creadoEn: Date }, usuarioId?: string) =>
  !!usuarioId && g.usuarioId === usuarioId && hoyColombia(g.creadoEn) === hoyColombia();

export async function listarGastos(
  localId: string,
  filtros: { anio: number; mes?: number; categoriaId?: string },
  /** Vendedor que consulta: sirve para saber qué gastos puede eliminar. */
  usuarioId?: string,
): Promise<ListaGastos> {
  const { desde, hasta } = rangoDias(filtros.anio, filtros.mes);
  const condiciones: SQL[] = [eq(gastos.localId, localId), gte(gastos.fecha, desde), lt(gastos.fecha, hasta)];
  if (filtros.categoriaId) condiciones.push(eq(gastos.categoriaId, filtros.categoriaId));

  const filas = await db
    .select()
    .from(gastos)
    .where(and(...condiciones))
    .orderBy(desc(gastos.fecha), desc(gastos.creadoEn));

  const lista: GastoFila[] = filas.map((g) => ({
    id: g.id,
    categoriaNombre: g.categoriaNombre,
    descripcion: g.descripcion,
    valor: g.valor,
    medioPago: g.medioPago,
    fecha: g.fecha,
    usuarioNombre: g.usuarioNombre,
    puedeEliminar: eliminable(g, usuarioId),
  }));

  const sumar = (medio?: MedioPagoGasto) =>
    lista.filter((g) => !medio || g.medioPago === medio).reduce((acc, g) => acc + g.valor, 0);

  return { gastos: lista, total: sumar(), totalEfectivo: sumar("EFECTIVO"), totalTransferencia: sumar("TRANSFERENCIA") };
}

export async function eliminarGasto(vendedor: VendedorSesion, id: string) {
  const gasto = await db.query.gastos.findFirst({ where: and(eq(gastos.id, id), eq(gastos.localId, vendedor.localId)) });
  if (!gasto) throw new ApiError(404, "El gasto no existe.");
  if (!eliminable(gasto, vendedor.id)) throw new ApiError(403, "Solo puedes eliminar tus propios gastos registrados hoy.");
  await db.delete(gastos).where(eq(gastos.id, id));
}

/** Gastos de un periodo para el Excel, del más antiguo al más reciente. */
export async function gastosDelPeriodo(localId: string, anio: number, mes?: number) {
  const { desde, hasta } = rangoDias(anio, mes);
  return db
    .select()
    .from(gastos)
    .where(and(eq(gastos.localId, localId), gte(gastos.fecha, desde), lt(gastos.fecha, hasta)))
    .orderBy(asc(gastos.fecha), asc(gastos.creadoEn));
}
