/**
 * Manejo de sesión en el servidor.
 * Además de verificar el token, consulta la base de datos en cada petición:
 * así, si el administrador PAUSA, ELIMINA o CAMBIA LA CONTRASEÑA de un usuario,
 * su sesión se cierra de inmediato.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { usuarios, type Usuario } from "@/db/schema";
import { COOKIE_SESION, DURACION_SESION_SEG, firmarToken, verificarToken } from "./jwt";

export type UsuarioSesion = Pick<
  Usuario,
  "id" | "nombre" | "identificacion" | "correo" | "telefono" | "rol" | "estado" | "localId"
> & { localNombre: string | null };

/** Crea la cookie de sesión después de un inicio de sesión correcto. */
export async function iniciarSesion(usuario: Pick<Usuario, "id" | "rol" | "versionSesion">) {
  const token = await firmarToken({ sub: usuario.id, rol: usuario.rol, v: usuario.versionSesion });
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });
}

export async function cerrarSesion() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

/**
 * Devuelve el usuario conectado o null.
 * Solo es válido si: el token es correcto, la versión coincide y la cuenta está ACTIVA.
 */
export async function obtenerUsuarioSesion(): Promise<UsuarioSesion | null> {
  const almacen = await cookies();
  const datos = await verificarToken(almacen.get(COOKIE_SESION)?.value);
  if (!datos) return null;

  const usuario = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, datos.sub),
    with: { local: { columns: { nombre: true, activo: true } } },
  });

  if (!usuario || usuario.versionSesion !== datos.v || usuario.estado !== "ACTIVO") return null;
  // Un vendedor necesita un local asignado y activo para trabajar
  if (usuario.rol === "VENDEDOR" && (!usuario.localId || !usuario.local?.activo)) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    identificacion: usuario.identificacion,
    correo: usuario.correo,
    telefono: usuario.telefono,
    rol: usuario.rol,
    estado: usuario.estado,
    localId: usuario.localId,
    localNombre: usuario.local?.nombre ?? null,
  };
}
