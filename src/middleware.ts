/**
 * Middleware: primera barrera de seguridad para las PÁGINAS.
 * - Sin sesión → al inicio de sesión.
 * - /admin solo para ADMIN, /panel solo para VENDEDOR.
 * (Las rutas /api se protegen dentro de cada endpoint con "manejador".)
 * La validación completa contra la base de datos se hace en los layouts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarToken } from "@/lib/auth/jwt";

const PUBLICAS = ["/login", "/registro", "/offline"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sesion = await verificarToken(req.cookies.get(COOKIE_SESION)?.value);
  const inicioDelRol = sesion?.rol === "ADMIN" ? "/admin" : "/panel/facturacion";

  if (PUBLICAS.some((ruta) => pathname.startsWith(ruta))) {
    // /offline nunca redirige: la descarga el service worker y no debe guardar el panel en su lugar
    if (pathname === "/offline") return NextResponse.next();
    // "expirada" indica que el servidor rechazó la sesión: se deja ver el login para no crear un ciclo
    if (sesion && !req.nextUrl.searchParams.has("expirada")) {
      return NextResponse.redirect(new URL(inicioDelRol, req.url));
    }
    return NextResponse.next();
  }

  if (!sesion) return NextResponse.redirect(new URL("/login", req.url));

  if (pathname.startsWith("/admin") && sesion.rol !== "ADMIN") return NextResponse.redirect(new URL(inicioDelRol, req.url));
  if (pathname.startsWith("/panel") && sesion.rol !== "VENDEDOR") return NextResponse.redirect(new URL(inicioDelRol, req.url));

  return NextResponse.next();
}

export const config = {
  // Se ejecuta en todas las páginas excepto API, archivos estáticos e íconos
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
