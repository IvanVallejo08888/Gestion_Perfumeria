import type { Metadata, Viewport } from "next";
import { RegistroPWA } from "@/components/pwa/RegistroPWA";
import { ProveedorAvisos } from "@/components/ui/Avisos";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gestión de Perfumerías", template: "%s · Gestión de Perfumerías" },
  description: "Facturación, créditos, inventario y reportes de tus locales.",
  // Metadatos para instalar en iPhone/iPad (el manifiesto lo agrega Next.js desde app/manifest.ts)
  appleWebApp: { capable: true, title: "Perfumerías", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

// Permite hacer zoom (importante para accesibilidad) y adapta la app a celulares
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4b0081",
};

/**
 * Guarda el aviso de "se puede instalar" apenas llega: ocurre una sola vez y puede ser antes
 * de que React cargue o de que se abra el menú del celular (ver BotonInstalar.tsx).
 */
const scriptInstalacion = `(function(){function c(e){window.__eventoInstalacion=e;window.dispatchEvent(new Event("pwa:instalacion"))}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();c(e)});window.addEventListener("appinstalled",function(){c(null)})})()`;

/**
 * Script mínimo que aplica el tamaño de letra y el tema guardados ANTES de pintar (evita saltos y parpadeo).
 * Con el tema "sistema" sigue en vivo los cambios del dispositivo. Ver hooks/usePreferencias.ts.
 */
const scriptPreferencias = `(function(){var h=document.documentElement;try{var t=localStorage.getItem("tamano-texto");if(t&&t!=="normal")h.dataset.texto=t}catch(e){}var m=window.matchMedia("(prefers-color-scheme: dark)");function p(){try{return localStorage.getItem("tema")||"claro"}catch(e){return"claro"}}function a(){var v=p();h.dataset.tema=v==="oscuro"||(v==="sistema"&&m.matches)?"oscuro":"claro"}a();m.addEventListener("change",function(){if(p()==="sistema")a()})})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: scriptPreferencias }} />
        <script dangerouslySetInnerHTML={{ __html: scriptInstalacion }} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* Enlace para saltar al contenido (lectores de pantalla y teclado) */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-tarjeta focus:px-4 focus:py-3 focus:font-bold"
        >
          Saltar al contenido principal
        </a>
        <ProveedorAvisos>{children}</ProveedorAvisos>
        <RegistroPWA />
      </body>
    </html>
  );
}
