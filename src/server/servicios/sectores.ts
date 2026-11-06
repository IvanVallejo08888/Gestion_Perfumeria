/**
 * Sectores de la ciudad de cada local.
 * El administrador los define; el vendedor solo elige entre los activos de su local.
 * La factura guarda el NOMBRE del sector (copia), así el historial no cambia si luego se edita.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { facturas, sectores } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { obtenerLocal } from "./locales";

/** Quita espacios de más: "  Las   Cuadras " → "Las Cuadras". */
const limpiar = (nombre: string) => nombre.trim().replace(/\s+/g, " ");
/** Clave para comparar nombres sin importar mayúsculas ni espacios de más. */
const clave = (nombre: string) => limpiar(nombre).toLocaleLowerCase("es");

/**
 * Separa una lista de nombres escritos por la persona en tres grupos:
 * nuevos, ya existentes pero desactivados (se reactivan) y repetidos (se ignoran).
 */
export function clasificarNombres<T extends { id: string; nombre: string; activo: boolean }>(nombres: string[], existentes: T[]) {
  const porClave = new Map(existentes.map((e) => [clave(e.nombre), e]));
  const vistos = new Set<string>();
  const nuevos: string[] = [];
  const reactivar: string[] = [];
  let repetidos = 0;

  for (const nombre of nombres) {
    const c = clave(nombre);
    const existente = porClave.get(c);
    if (vistos.has(c) || existente?.activo) repetidos++;
    else if (existente) reactivar.push(existente.id);
    else nuevos.push(limpiar(nombre));
    vistos.add(c);
  }
  return { nuevos, reactivar, repetidos };
}

/** Orden alfabético en español; los desactivados van al final. */
export function ordenarPorNombre<T extends { nombre: string; activo: boolean }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"));
}

export async function listarSectores(localId: string, opciones: { soloActivos?: boolean } = {}) {
  const lista = await db
    .select({ id: sectores.id, nombre: sectores.nombre, activo: sectores.activo })
    .from(sectores)
    .where(and(eq(sectores.localId, localId), opciones.soloActivos ? eq(sectores.activo, true) : undefined));
  return ordenarPorNombre(lista);
}

export async function agregarSectores(localId: string, nombres: string[]) {
  await obtenerLocal(localId);
  return db.transaction(async (tx) => {
    const existentes = await tx.select().from(sectores).where(eq(sectores.localId, localId));
    const { nuevos, reactivar, repetidos } = clasificarNombres(nombres, existentes);
    if (nuevos.length) await tx.insert(sectores).values(nuevos.map((nombre) => ({ localId, nombre })));
    for (const id of reactivar) await tx.update(sectores).set({ activo: true }).where(eq(sectores.id, id));
    return { agregados: nuevos.length, reactivados: reactivar.length, repetidos };
  });
}

async function obtenerSector(id: string) {
  const sector = await db.query.sectores.findFirst({ where: eq(sectores.id, id) });
  if (!sector) throw new ApiError(404, "El sector no existe.");
  return sector;
}

export async function editarSector(id: string, datos: { nombre?: string; activo?: boolean }) {
  const sector = await obtenerSector(id);
  const nombre = datos.nombre === undefined ? undefined : limpiar(datos.nombre);
  if (nombre !== undefined) {
    const repetido = await db.query.sectores.findFirst({
      where: and(eq(sectores.localId, sector.localId), sql`lower(${sectores.nombre}) = lower(${nombre})`),
    });
    if (repetido && repetido.id !== id) throw new ApiError(409, `Ya existe el sector «${repetido.nombre}» en este local.`);
  }
  await db.update(sectores).set({ nombre, activo: datos.activo }).where(eq(sectores.id, id));
}

/** Si el sector ya se usó en facturas solo se desactiva, para no afectar el historial. */
export async function eliminarSector(id: string): Promise<"eliminado" | "desactivado"> {
  const sector = await obtenerSector(id);
  const [usado] = await db
    .select({ id: facturas.id })
    .from(facturas)
    .where(and(eq(facturas.localId, sector.localId), sql`lower(${facturas.clienteSector}) = lower(${sector.nombre})`))
    .limit(1);

  if (usado) {
    await db.update(sectores).set({ activo: false }).where(eq(sectores.id, id));
    return "desactivado";
  }
  await db.delete(sectores).where(eq(sectores.id, id));
  return "eliminado";
}
