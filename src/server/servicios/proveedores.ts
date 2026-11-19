/**
 * Proveedores de mercancía de cada local (pestaña «Proveedores» del Inventario).
 *  - Alta y edición: nombre (único por local, sin importar mayúsculas), contacto, teléfono y productos que surte.
 *  - Un proveedor no se borra (puede tener compras): se desactiva y deja de salir al registrar compras.
 *  - Cada proveedor muestra cuánto se le debe: suma de los saldos de sus compras a crédito pendientes.
 */
import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonosProveedor, comprasMercancia, proveedores } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { Proveedor, ProveedorDetalle } from "@/tipos";

export interface DatosProveedor {
  nombre: string;
  contacto: string;
  telefono: string;
  productosSurte: string;
  activo: boolean;
}

/*
 * Columnas del proveedor + su deuda calculada con las compras a crédito pendientes.
 * La tabla se nombra a mano ("proveedores"."id"): en una consulta de una sola tabla Drizzle escribe la
 * columna sin el nombre de la tabla, y dentro de la subconsulta "id" apuntaría a la compra, no al proveedor.
 */
const pendientesDelProveedor = sql`from ${comprasMercancia} c where c.proveedor_id = "proveedores"."id" and c.estado = 'PENDIENTE'`;
const columnasProveedor = {
  id: proveedores.id,
  nombre: proveedores.nombre,
  contacto: proveedores.contacto,
  telefono: proveedores.telefono,
  productosSurte: proveedores.productosSurte,
  activo: proveedores.activo,
  deuda: sql<number>`(select coalesce(sum(c.saldo), 0)::int ${pendientesDelProveedor})`,
  comprasPendientes: sql<number>`(select count(*)::int ${pendientesDelProveedor})`,
};

export async function listarProveedores(localId: string, opciones: { soloActivos?: boolean } = {}): Promise<Proveedor[]> {
  return db
    .select(columnasProveedor)
    .from(proveedores)
    .where(and(eq(proveedores.localId, localId), opciones.soloActivos ? eq(proveedores.activo, true) : undefined))
    .orderBy(desc(proveedores.activo), asc(sql`lower(${proveedores.nombre})`));
}

async function obtenerProveedor(localId: string, id: string): Promise<Proveedor> {
  const [proveedor] = await db
    .select(columnasProveedor)
    .from(proveedores)
    .where(and(eq(proveedores.id, id), eq(proveedores.localId, localId)));
  if (!proveedor) throw new ApiError(404, "El proveedor no existe.");
  return proveedor;
}

/** Ficha del proveedor: datos, deuda, compras (las pendientes primero) y abonos de cada una. */
export async function obtenerProveedorDetalle(localId: string, id: string): Promise<ProveedorDetalle> {
  const proveedor = await obtenerProveedor(localId, id);
  const compras = await db
    .select()
    .from(comprasMercancia)
    .where(and(eq(comprasMercancia.localId, localId), eq(comprasMercancia.proveedorId, id)))
    .orderBy(asc(comprasMercancia.estado), desc(comprasMercancia.creadoEn));

  const abonos = compras.length
    ? await db
        .select()
        .from(abonosProveedor)
        .where(inArray(abonosProveedor.compraId, compras.map((c) => c.id)))
        .orderBy(desc(abonosProveedor.fecha), desc(abonosProveedor.creadoEn))
    : [];

  return {
    ...proveedor,
    totalAbonado: abonos.reduce((acc, a) => acc + a.valor, 0),
    compras: compras.map((c) => ({
      id: c.id,
      productoNombre: c.productoNombre,
      cantidad: c.cantidad,
      total: c.total,
      medioPago: c.medioPago,
      saldo: c.saldo,
      estado: c.estado,
      usuarioNombre: c.usuarioNombre,
      nota: c.nota,
      creadoEn: c.creadoEn.toISOString(),
      saldadaEn: c.saldadaEn?.toISOString() ?? null,
      abonos: abonos
        .filter((a) => a.compraId === c.id)
        .map((a) => ({
          id: a.id,
          valor: a.valor,
          medioPago: a.medioPago,
          valorEfectivo: a.valorEfectivo,
          valorTransferencia: a.valorTransferencia,
          fecha: a.fecha,
          usuarioNombre: a.usuarioNombre,
          nota: a.nota,
        })),
    })),
  };
}

/** Evita dos proveedores con el mismo nombre en el local (sin importar mayúsculas). */
async function verificarNombre(localId: string, nombre: string, excluirId?: string) {
  const repetido = await db.query.proveedores.findFirst({
    where: and(
      eq(proveedores.localId, localId),
      sql`lower(${proveedores.nombre}) = lower(${nombre})`,
      excluirId ? ne(proveedores.id, excluirId) : undefined,
    ),
    columns: { nombre: true },
  });
  if (repetido) throw new ApiError(409, `Ya existe el proveedor «${repetido.nombre}» en este local.`);
}

const aFila = (datos: DatosProveedor) => ({
  nombre: datos.nombre,
  contacto: datos.contacto || null,
  telefono: datos.telefono || null,
  productosSurte: datos.productosSurte || null,
  activo: datos.activo,
});

export async function crearProveedor(localId: string, datos: DatosProveedor) {
  await verificarNombre(localId, datos.nombre);
  const [nuevo] = await db
    .insert(proveedores)
    .values({ localId, ...aFila(datos) })
    .returning({ id: proveedores.id });
  return obtenerProveedor(localId, nuevo.id);
}

export async function editarProveedor(localId: string, id: string, datos: DatosProveedor) {
  await obtenerProveedor(localId, id); // 404 si no es de este local
  await verificarNombre(localId, datos.nombre, id);
  await db.update(proveedores).set(aFila(datos)).where(and(eq(proveedores.id, id), eq(proveedores.localId, localId)));
  return obtenerProveedor(localId, id);
}
