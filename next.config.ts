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
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "bcryptjs"],
  env: { NEXT_PUBLIC_VERSION_APP: Date.now().toString(36) },
  htmlLimitedBots: /.*/,
  async headers() {
    return [
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
