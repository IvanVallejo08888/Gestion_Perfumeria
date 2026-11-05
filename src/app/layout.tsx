import type { Metadata, Viewport } from "next";
import { ProveedorAvisos } from "@/components/ui/Avisos";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gestión de Perfumerías", template: "%s · Gestión de Perfumerías" },
  description: "Facturación, créditos, inventario y reportes de tus locales.",
};

// Permite hacer zoom (importante para accesibilidad) y adapta la app a celulares
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b21b6",
};

/** Script mínimo que aplica el tamaño de letra guardado ANTES de pintar (evita saltos). */
const scriptTamanoTexto = `try{var t=localStorage.getItem("tamano-texto");if(t)document.documentElement.dataset.texto=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: scriptTamanoTexto }} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* Enlace para saltar al contenido (lectores de pantalla y teclado) */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-bold"
        >
          Saltar al contenido principal
        </a>
        <ProveedorAvisos>{children}</ProveedorAvisos>
      </body>
    </html>
  );
}
