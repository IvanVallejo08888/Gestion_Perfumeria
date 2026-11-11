/**
 * Marcas (casas de perfume) de cada local.
 * El administrador las gestiona; el vendedor elige entre las activas al crear o editar un producto
 * y puede agregar una nueva desde ese mismo formulario.
 * La factura guarda el NOMBRE de la marca (copia), así el historial no cambia si luego se edita.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marcas, productos } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { obtenerLocal } from "./locales";
import { clasificarNombres, limpiar, ordenarPorNombre } from "./sectores";

export async function listarMarcas(localId: string, opciones: { soloActivas?: boolean } = {}) {
  const lista = await db
    .select({ id: marcas.id, nombre: marcas.nombre, activo: marcas.activo })
    .from(marcas)
    .where(and(eq(marcas.localId, localId), opciones.soloActivas ? eq(marcas.activo, true) : undefined));
  return ordenarPorNombre(lista);
}

export async function agregarMarcas(localId: string, nombres: string[]) {
  await obtenerLocal(localId);
  return db.transaction(async (tx) => {
    const existentes = await tx.select().from(marcas).where(eq(marcas.localId, localId));
    const { nuevos, reactivar, repetidos } = clasificarNombres(nombres, existentes);
    if (nuevos.length) await tx.insert(marcas).values(nuevos.map((nombre) => ({ localId, nombre })));
    for (const id of reactivar) await tx.update(marcas).set({ activo: true }).where(eq(marcas.id, id));
    return { agregados: nuevos.length, reactivados: reactivar.length, repetidos };
  });
}

/**
 * El vendedor agrega UNA marca desde el formulario de producto y queda elegida.
 * Si ya existe activa (sin importar mayúsculas) se devuelve esa, sin duplicar.
 * Si el administrador la desactivó, el vendedor no la puede revivir.
 */
export async function crearMarcaDelLocal(localId: string, nombreEscrito: string): Promise<{ id: string; nombre: string; existia: boolean }> {
  const nombre = limpiar(nombreEscrito);
  const buscar = () =>
    db.query.marcas.findFirst({ where: and(eq(marcas.localId, localId), sql`lower(${marcas.nombre}) = lower(${nombre})`) });

  const existente = await buscar();
  if (existente) {
    if (!existente.activo) {
      throw new ApiError(409, `La marca «${existente.nombre}» está desactivada. Pide al administrador que la active en Locales → Editar.`);
    }
    return { id: existente.id, nombre: existente.nombre, existia: true };
  }
  // Si otra persona la creó al mismo tiempo, el índice único evita el duplicado y se usa la suya
  const [nueva] = await db.insert(marcas).values({ localId, nombre }).onConflictDoNothing().returning();
  if (nueva) return { id: nueva.id, nombre: nueva.nombre, existia: false };
  const ganadora = await buscar();
  if (!ganadora) throw new ApiError(500, "No se pudo guardar la marca. Intenta de nuevo.");
  return { id: ganadora.id, nombre: ganadora.nombre, existia: true };
}

async function obtenerMarca(id: string) {
  const marca = await db.query.marcas.findFirst({ where: eq(marcas.id, id) });
  if (!marca) throw new ApiError(404, "La marca no existe.");
  return marca;
}

export async function editarMarca(id: string, datos: { nombre?: string; activo?: boolean }) {
  const marca = await obtenerMarca(id);
  const nombre = datos.nombre === undefined ? undefined : limpiar(datos.nombre);
  if (nombre !== undefined) {
    const repetida = await db.query.marcas.findFirst({
      where: and(eq(marcas.localId, marca.localId), sql`lower(${marcas.nombre}) = lower(${nombre})`),
    });
    if (repetida && repetida.id !== id) throw new ApiError(409, `Ya existe la marca «${repetida.nombre}» en este local.`);
  }
  await db.update(marcas).set({ nombre, activo: datos.activo }).where(eq(marcas.id, id));
}

/** Si la marca ya se usó en algún producto (aunque esté oculto) solo se desactiva. */
export async function eliminarMarca(id: string): Promise<"eliminado" | "desactivado"> {
  await obtenerMarca(id);
  const [usada] = await db.select({ id: productos.id }).from(productos).where(eq(productos.marcaId, id)).limit(1);
  if (usada) {
    await db.update(marcas).set({ activo: false }).where(eq(marcas.id, id));
    return "desactivado";
  }
  await db.delete(marcas).where(eq(marcas.id, id));
  return "eliminado";
}

/**
 * Verifica que la marca elegida para un producto sea del local y esté activa.
 * Excepción: al editar, el producto puede conservar la marca que ya tenía aunque esté desactivada.
 */
export async function validarMarcaDelLocal(localId: string, marcaId: string, marcaActual?: string | null) {
  const marca = await db.query.marcas.findFirst({ where: and(eq(marcas.id, marcaId), eq(marcas.localId, localId)) });
  if (!marca || (!marca.activo && marca.id !== marcaActual)) {
    throw new ApiError(400, "La marca elegida no existe o está desactivada en este local.");
  }
}
