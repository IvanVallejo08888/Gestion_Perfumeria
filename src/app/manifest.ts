import type { MetadataRoute } from "next";

const ICONO_ATAJO = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];

/** Manifiesto de la PWA: Next.js lo publica en /manifest.webmanifest y lo enlaza en todas las páginas. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Gestión de Perfumerías",
    short_name: "Perfumerías",
    description: "Facturación, créditos, inventario y reportes de tus locales.",
    lang: "es-CO",
    dir: "ltr",
    display: "standalone",
    start_url: "/",
    scope: "/",
    theme_color: "#530309",
    background_color: "#f7f3ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Facturación", short_name: "Facturar", url: "/panel/facturacion", icons: ICONO_ATAJO },
      { name: "Créditos", short_name: "Créditos", url: "/panel/creditos", icons: ICONO_ATAJO },
      { name: "Notificaciones", short_name: "Avisos", url: "/panel/notificaciones", icons: ICONO_ATAJO },
    ],
  };
}
