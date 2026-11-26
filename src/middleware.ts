/**
 * Middleware: primera barrera de seguridad para las PÁGINAS.
 * - Sin sesión → al inicio de sesión.
 * - /admin solo para ADMIN, /panel solo para VENDEDOR.
 * - Agrega la Política de Seguridad de Contenido (CSP) con un "nonce" nuevo en cada petición.
 * (Las rutas /api se protegen dentro de cada endpoint con "manejador".)
 * La validación completa contra la base de datos se hace en los layouts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarToken } from "@/lib/auth/jwt";

const PUBLICAS = ["/login", "/registro", "/offline"];
const DESARROLLO = process.env.NODE_ENV !== "production";

/**
 * CSP: le dice al navegador de dónde puede cargar cada cosa. Si alguien lograra inyectar
 * un <script> en la página (XSS), el navegador no lo ejecutaría porque no tiene el nonce.
 * - script-src: solo scripts con el nonce de esta respuesta; 'strict-dynamic' deja que esos
 *   scripts carguen los demás trozos de la app (Next.js, html-to-image, jsPDF).
 * - style-src 'unsafe-inline': React y Tailwind usan estilos en línea; el riesgo es bajo.
 * - Google Fonts: hojas de estilo y fuentes (html-to-image también las descarga para la factura).
 * - img-src data:/blob:: imágenes de la factura (PNG/PDF) generadas en el navegador.
 * - frame-ancestors 'none': nadie puede meter la app en un iframe (clickjacking).
 * En desarrollo, Next.js necesita eval y su websocket de recarga en caliente.
 */
function politicaContenido(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${DESARROLLO ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com${DESARROLLO ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(DESARROLLO ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sesion = await verificarToken(req.cookies.get(COOKIE_SESION)?.value);
  const inicioDelRol = sesion?.rol === "ADMIN" ? "/admin" : "/panel/facturacion";
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, req.url));

  if (PUBLICAS.some((ruta) => pathname.startsWith(ruta))) {
    // /offline nunca redirige: la descarga el service worker y no debe guardar el panel en su lugar
    if (pathname === "/offline") return continuar(req);
    // "expirada" indica que el servidor rechazó la sesión: se deja ver el login para no crear un ciclo
    if (sesion && !req.nextUrl.searchParams.has("expirada")) return ir(inicioDelRol);
    return continuar(req);
  }

  if (!sesion) return ir("/login");

  if (pathname.startsWith("/admin") && sesion.rol !== "ADMIN") return ir(inicioDelRol);
  if (pathname.startsWith("/panel") && sesion.rol !== "VENDEDOR") return ir(inicioDelRol);

  return continuar(req);
}

/**
 * Deja pasar la petición con la CSP. Next.js lee el nonce del encabezado
 * "content-security-policy" de la PETICIÓN y lo pone en sus propios scripts;
 * "x-nonce" lo usa app/layout.tsx para los scripts escritos a mano.
 */
function continuar(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = politicaContenido(nonce);

  const encabezados = new Headers(req.headers);
  encabezados.set("x-nonce", nonce);
  encabezados.set("content-security-policy", csp);

  const respuesta = NextResponse.next({ request: { headers: encabezados } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  // Se ejecuta en todas las páginas excepto API, archivos estáticos e íconos
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
