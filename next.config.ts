import type { NextConfig } from "next";

/**
 * Configuración de Next.js.
 * - serverExternalPackages: librerías que solo se usan en el servidor y no deben empaquetarse.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "bcryptjs"],
};

export default nextConfig;
