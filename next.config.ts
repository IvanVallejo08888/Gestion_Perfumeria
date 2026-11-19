import type { NextConfig } from "next";

/**
 * Configuración de Next.js.
 * - serverExternalPackages: librerías que solo se usan en el servidor y no deben empaquetarse.
 * - NEXT_PUBLIC_VERSION_APP: cambia en cada compilación; RegistroPWA la pasa a /sw.js para
 *   que cada publicación instale un service worker nuevo y se avise de la actualización.
 * - htmlLimitedBots: obliga a escribir los metadatos dentro del <head>. Por defecto, en páginas
 *   dinámicas (login, panel) Next.js los envía después, en el <body>; ahí Chrome no reconoce
 *   el manifiesto (la app no se podría instalar) y tampoco sirven las etiquetas de iOS.
 * - headers: el navegador siempre debe revisar si /sw.js cambió, y este controla todo el sitio.
 *   Además, encabezados de seguridad en TODAS las respuestas (páginas, API y archivos).
 *   La CSP no está aquí: necesita un nonce distinto en cada petición (ver middleware.ts).
 */
const encabezadosSeguridad = [
  // No adivinar el tipo de archivo (evita que un texto se ejecute como script)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nadie puede mostrar la app dentro de un iframe (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // A otros sitios (por ejemplo wa.me) solo se les dice el dominio, nunca la ruta con datos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Funciones del dispositivo que la app no usa quedan apagadas
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // Aísla la ventana de la app de las que abre (wa.me) o que la abren
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Solo HTTPS durante 2 años (en local con http no aplica, por eso solo en producción)
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "bcryptjs"],
  env: { NEXT_PUBLIC_VERSION_APP: Date.now().toString(36) },
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      { source: "/:path*", headers: encabezadosSeguridad },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
