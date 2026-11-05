/**
 * POST /api/auth/logout — Cierra la sesión (botón "Cerrar sesión").
 * GET  /api/auth/logout — Usado por el servidor cuando la sesión ya no es válida
 *                         (cuenta pausada, contraseña cambiada, etc.): borra la cookie y lleva al login.
 */
import { NextResponse, type NextRequest } from "next/server";
import { manejador, ok } from "@/lib/api";
import { COOKIE_SESION } from "@/lib/auth/jwt";
import { cerrarSesion } from "@/lib/auth/sesion";

export const POST = manejador("PUBLICO", async () => {
  await cerrarSesion();
  return ok({ ok: true });
});

export async function GET(req: NextRequest) {
  const respuesta = NextResponse.redirect(new URL("/login?expirada=1", req.url));
  respuesta.cookies.delete(COOKIE_SESION);
  return respuesta;
}
