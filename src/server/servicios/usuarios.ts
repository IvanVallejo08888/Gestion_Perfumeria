/**
 * Servicio de usuarios: registro, inicio de sesión y gestión por parte del administrador.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { locales, usuarios, type Usuario } from "@/db/schema";
import { ApiError } from "@/lib/api";

const RONDAS_BCRYPT = 12;

/** Columnas seguras para enviar al navegador (nunca el hash de la contraseña). */
const columnasPublicas = {
  id: usuarios.id,
  nombre: usuarios.nombre,
  identificacion: usuarios.identificacion,
  correo: usuarios.correo,
  telefono: usuarios.telefono,
  estado: usuarios.estado,
  localId: usuarios.localId,
  creadoEn: usuarios.creadoEn,
};

export type UsuarioPublico = Pick<
  Usuario,
  "id" | "nombre" | "identificacion" | "correo" | "telefono" | "estado" | "localId" | "creadoEn"
> & { localNombre: string | null };

/* ------------------------------ Registro / Login ------------------------------ */

export async function registrarUsuario(datos: {
  nombre: string;
  identificacion: string;
  correo: string;
  telefono: string;
  password: string;
}) {
  await verificarDatosUnicos(datos.identificacion, datos.correo);
  await db.insert(usuarios).values({
    nombre: datos.nombre,
    identificacion: datos.identificacion,
    correo: datos.correo,
    telefono: datos.telefono,
    passwordHash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
    rol: "VENDEDOR",
    estado: "PENDIENTE",
  });
}

/**
 * Verifica identificación y contraseña.
 * Lanza mensajes claros si la cuenta está pendiente, pausada o sin local.
 */
export async function autenticar(identificacion: string, password: string) {
  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.identificacion, identificacion.trim()),
    with: { local: { columns: { activo: true } } },
  });

  // Mismo mensaje en ambos casos para no revelar qué identificaciones existen
  const valida = usuario ? await bcrypt.compare(password, usuario.passwordHash) : false;
  if (!usuario || !valida) throw new ApiError(401, "La identificación o la contraseña no son correctas.");

  if (usuario.rol === "VENDEDOR") {
    if (usuario.estado === "PAUSADO") {
      throw new ApiError(403, "Tu cuenta está en pausa. Comunícate con el administrador.");
    }
    if (usuario.estado === "PENDIENTE" || !usuario.localId) {
      throw new ApiError(
        403,
        "Tu cuenta ya fue creada, pero el administrador aún no te ha asignado un local. Por favor espera a que lo haga.",
      );
    }
    if (!usuario.local?.activo) {
      throw new ApiError(403, "El local asignado a tu cuenta está desactivado. Comunícate con el administrador.");
    }
  }
  return usuario;
}

/* ------------------------------ Gestión (admin) ------------------------------ */

export async function listarUsuarios(filtros: { estado?: string; texto?: string }): Promise<UsuarioPublico[]> {
  const condiciones: SQL[] = [eq(usuarios.rol, "VENDEDOR")];
  if (filtros.estado === "PENDIENTE" || filtros.estado === "ACTIVO" || filtros.estado === "PAUSADO") {
    condiciones.push(eq(usuarios.estado, filtros.estado));
  }
  if (filtros.texto?.trim()) {
    const t = `%${filtros.texto.trim()}%`;
    condiciones.push(or(ilike(usuarios.nombre, t), ilike(usuarios.identificacion, t), ilike(usuarios.correo, t))!);
  }

  return db
    .select({ ...columnasPublicas, localNombre: locales.nombre })
    .from(usuarios)
    .leftJoin(locales, eq(usuarios.localId, locales.id))
    .where(and(...condiciones))
    // Primero los pendientes (requieren acción del administrador)
    .orderBy(sql`case when ${usuarios.estado} = 'PENDIENTE' then 0 else 1 end`, asc(usuarios.nombre));
}

export async function editarUsuario(
  id: string,
  datos: { nombre: string; identificacion: string; correo: string; telefono: string },
) {
  await obtenerVendedor(id);
  await verificarDatosUnicos(datos.identificacion, datos.correo, id);
  await db.update(usuarios).set(datos).where(eq(usuarios.id, id));
}

/** Asigna un local. Si la cuenta estaba PENDIENTE, queda ACTIVA. */
export async function asignarLocal(id: string, localId: string) {
  const usuario = await obtenerVendedor(id);
  const local = await db.query.locales.findFirst({ where: eq(locales.id, localId) });
  if (!local) throw new ApiError(404, "El local seleccionado no existe.");
  if (!local.activo) throw new ApiError(400, "No puedes asignar un local desactivado.");

  await db
    .update(usuarios)
    .set({
      localId,
      estado: usuario.estado === "PENDIENTE" ? "ACTIVO" : usuario.estado,
      // Si cambia de local, se cierran sus sesiones abiertas
      versionSesion: usuario.localId && usuario.localId !== localId ? usuario.versionSesion + 1 : usuario.versionSesion,
    })
    .where(eq(usuarios.id, id));
}

/** Cambia la contraseña de cualquier vendedor o del propio administrador. Cierra sus sesiones. */
export async function cambiarPassword(id: string, password: string) {
  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!usuario) throw new ApiError(404, "El usuario no existe.");
  await db
    .update(usuarios)
    .set({ passwordHash: await bcrypt.hash(password, RONDAS_BCRYPT), versionSesion: usuario.versionSesion + 1 })
    .where(eq(usuarios.id, id));
  return usuario;
}

/** Pausa (cierra sesión inmediatamente) o reactiva una cuenta. */
export async function cambiarEstado(id: string, estado: "ACTIVO" | "PAUSADO") {
  const usuario = await obtenerVendedor(id);
  if (estado === "ACTIVO" && !usuario.localId) {
    throw new ApiError(400, "Primero asígnale un local a este usuario para poder activarlo.");
  }
  await db
    .update(usuarios)
    .set({ estado, versionSesion: estado === "PAUSADO" ? usuario.versionSesion + 1 : usuario.versionSesion })
    .where(eq(usuarios.id, id));
}

/** Elimina un vendedor. Sus facturas se conservan (quedan sin usuario, pero con su nombre). */
export async function eliminarUsuario(id: string) {
  await obtenerVendedor(id);
  await db.delete(usuarios).where(eq(usuarios.id, id));
}

export async function contarUsuariosPorEstado() {
  const filas = await db
    .select({ estado: usuarios.estado, total: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(eq(usuarios.rol, "VENDEDOR"))
    .groupBy(usuarios.estado);
  const conteo = { PENDIENTE: 0, ACTIVO: 0, PAUSADO: 0 };
  for (const f of filas) conteo[f.estado] = f.total;
  return conteo;
}

/* --------------------------------- Auxiliares --------------------------------- */

/** El administrador nunca puede editarse, pausarse o eliminarse desde la gestión de usuarios. */
async function obtenerVendedor(id: string) {
  const usuario = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) });
  if (!usuario) throw new ApiError(404, "El usuario no existe.");
  if (usuario.rol === "ADMIN") throw new ApiError(403, "La cuenta del administrador no se puede modificar desde aquí.");
  return usuario;
}

async function verificarDatosUnicos(identificacion: string, correo: string, excluirId?: string) {
  const repetido = await db.query.usuarios.findFirst({
    where: or(eq(usuarios.identificacion, identificacion), eq(usuarios.correo, correo)),
  });
  if (repetido && repetido.id !== excluirId) {
    throw new ApiError(
      409,
      repetido.identificacion === identificacion
        ? "Ya existe una cuenta con esa identificación."
        : "Ya existe una cuenta con ese correo electrónico.",
    );
  }
}
