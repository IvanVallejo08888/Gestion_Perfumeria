/**
 * Utilidades para las rutas de la API (app/api/**).
 *
 * "manejador" envuelve cada endpoint para:
 *  1. Verificar la sesión y el rol requerido.
 *  2. Convertir errores conocidos en respuestas JSON con mensajes claros en español.
 *
 * Ejemplo:
 *   export const GET = manejador("VENDEDOR", async ({ usuario }) => ok({ ... }));
 */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { obtenerUsuarioSesion, type UsuarioSesion } from "./auth/sesion";
import { primerError } from "./validaciones";

/** Error con código HTTP y mensaje pensado para mostrarse al usuario. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const ok = <T>(datos: T, status = 200) => NextResponse.json(datos, { status });

/** PUBLICO: sin sesión · AUTENTICADO: cualquier rol · ADMIN / VENDEDOR: rol exacto. */
type RolRequerido = "ADMIN" | "VENDEDOR" | "AUTENTICADO" | "PUBLICO";

interface Contexto<P> {
  req: NextRequest;
  usuario: UsuarioSesion;
  params: P;
}

/** Vendedor con local garantizado (para no tener que comprobarlo en cada ruta). */
export type VendedorSesion = UsuarioSesion & { localId: string };

export function manejador<P = Record<string, string>>(
  rol: RolRequerido,
  fn: (ctx: Contexto<P>) => Promise<Response>,
) {
  return async (req: NextRequest, segmento: { params: Promise<P> }) => {
    try {
      const params = (await segmento?.params) ?? ({} as P);
      let usuario = null as unknown as UsuarioSesion;

      if (rol !== "PUBLICO") {
        const sesion = await obtenerUsuarioSesion();
        if (!sesion) throw new ApiError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
        if (rol !== "AUTENTICADO" && sesion.rol !== rol) throw new ApiError(403, "No tienes permiso para realizar esta acción.");
        usuario = sesion;
      }
      return await fn({ req, usuario, params });
    } catch (error) {
      return respuestaDeError(error);
    }
  };
}

/** Lee y valida el cuerpo JSON de la petición con un esquema Zod. */
export async function leerCuerpo<T>(req: NextRequest, esquema: ZodType<T>): Promise<T> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    throw new ApiError(400, "La información enviada no tiene un formato válido.");
  }
  return esquema.parse(cuerpo);
}

/** Asegura que el usuario tenga local (todas las rutas de vendedor lo requieren). */
export function comoVendedor(usuario: UsuarioSesion): VendedorSesion {
  if (!usuario.localId) throw new ApiError(403, "Tu cuenta aún no tiene un local asignado.");
  return usuario as VendedorSesion;
}

/** Errores de red de "pg" y de PostgreSQL que significan "no se pudo llegar a la base de datos". */
const CODIGOS_SIN_CONEXION = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "57P01", "57P03"]);

function respuestaDeError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: primerError(error) }, { status: 400 });
  }
  // Violación de restricción única en PostgreSQL (dato repetido)
  const causa = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
  if (causa?.code === "23505") {
    return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
  }
  // La base de datos no responde (apagada, sin red o reiniciando). Antes salía "error inesperado"
  // y en el inicio de sesión parecía que la cuenta estaba mal.
  if (causa?.code && CODIGOS_SIN_CONEXION.has(causa.code)) {
    console.error("[API] No hay conexión con la base de datos:", causa.code);
    return NextResponse.json(
      { error: "No hay conexión con la base de datos. Tus datos están bien: avisa al administrador para que revise el servidor." },
      { status: 503 },
    );
  }
  console.error("[API] Error inesperado:", error);
  return NextResponse.json(
    { error: "Ocurrió un error inesperado. Intenta de nuevo en unos segundos." },
    { status: 500 },
  );
}
