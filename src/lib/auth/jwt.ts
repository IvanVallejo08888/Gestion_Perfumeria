/**
 * Firma y verificación del token de sesión (JWT).
 * Usa "jose", que funciona tanto en el servidor como en el middleware (Edge).
 * El token se guarda en una cookie httpOnly: el navegador no puede leerla con JavaScript.
 */
import { jwtVerify, SignJWT } from "jose";

export const COOKIE_SESION = "gp_sesion";
/** Duración de la sesión: 12 horas. */
export const DURACION_SESION_SEG = 60 * 60 * 12;

export type Rol = "ADMIN" | "VENDEDOR";

export interface DatosToken {
  /** id del usuario */
  sub: string;
  rol: Rol;
  /** versión de sesión: si no coincide con la BD, la sesión deja de ser válida */
  v: number;
}

function clave(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("AUTH_SECRET no está configurado o tiene menos de 32 caracteres. Revisa el archivo .env");
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarToken(datos: DatosToken): Promise<string> {
  return new SignJWT({ rol: datos.rol, v: datos.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(datos.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(clave());
}

/** Devuelve los datos del token o null si es inválido o expiró. */
export async function verificarToken(token: string | undefined): Promise<DatosToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    if (!payload.sub || (payload.rol !== "ADMIN" && payload.rol !== "VENDEDOR")) return null;
    return { sub: payload.sub, rol: payload.rol, v: Number(payload.v ?? 0) };
  } catch {
    return null;
  }
}
