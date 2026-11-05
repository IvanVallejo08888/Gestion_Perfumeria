/**
 * Servicio de locales (solo el administrador los crea y edita).
 */
import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { locales } from "@/db/schema";
import { ApiError } from "@/lib/api";

export interface LocalResumen {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  totalUsuarios: number;
  totalProductos: number;
}

export async function listarLocales(): Promise<LocalResumen[]> {
  return db
    .select({
      id: locales.id,
      nombre: locales.nombre,
      direccion: locales.direccion,
      telefono: locales.telefono,
      activo: locales.activo,
      totalUsuarios: sql<number>`(select count(*)::int from usuarios u where u.local_id = ${locales.id})`,
      totalProductos: sql<number>`(select count(*)::int from productos p where p.local_id = ${locales.id} and p.activo)`,
    })
    .from(locales)
    .orderBy(asc(locales.nombre));
}

export async function crearLocal(datos: { nombre: string; direccion: string; telefono: string; activo: boolean }) {
  await verificarNombre(datos.nombre);
  const [local] = await db
    .insert(locales)
    .values({ nombre: datos.nombre, direccion: datos.direccion || null, telefono: datos.telefono || null, activo: datos.activo })
    .returning();
  return local;
}

export async function editarLocal(
  id: string,
  datos: { nombre: string; direccion: string; telefono: string; activo: boolean },
) {
  const local = await db.query.locales.findFirst({ where: eq(locales.id, id) });
  if (!local) throw new ApiError(404, "El local no existe.");
  await verificarNombre(datos.nombre, id);
  await db
    .update(locales)
    .set({ nombre: datos.nombre, direccion: datos.direccion || null, telefono: datos.telefono || null, activo: datos.activo })
    .where(eq(locales.id, id));
}

export async function obtenerLocal(id: string) {
  const local = await db.query.locales.findFirst({ where: eq(locales.id, id) });
  if (!local) throw new ApiError(404, "El local no existe.");
  return local;
}

async function verificarNombre(nombre: string, excluirId?: string) {
  const repetido = await db.query.locales.findFirst({ where: sql`lower(${locales.nombre}) = lower(${nombre})` });
  if (repetido && repetido.id !== excluirId) throw new ApiError(409, "Ya existe un local con ese nombre.");
}
