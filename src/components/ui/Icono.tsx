/**
 * Íconos sencillos en SVG (sin librerías externas).
 * Son decorativos (aria-hidden): SIEMPRE van acompañados de un texto visible.
 */
const RUTAS = {
  factura: "M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Zm2 5h6M9 12h6M9 16h4",
  historial: "M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5",
  credito: "M3 7h18v10H3zM3 11h18M7 15h3",
  reporte: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  campana: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4 13a2 2 0 0 0 4 0",
  inventario: "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
  inicio: "M3 11l9-8 9 8M5 10v10h14V10",
  local: "M3 9l2-5h14l2 5M3 9h18v11H3zM9 20v-6h6v6",
  usuarios: "M16 20v-2a4 4 0 0 0-8 0v2M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 8v-2a3 3 0 0 0-2-2.8M18 4.3a3 3 0 0 1 0 5.4",
  cuenta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  salir: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  menu: "M3 6h18M3 12h18M3 18h18",
  cerrar: "M6 6l12 12M18 6 6 18",
  buscar: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3",
  mas: "M12 5v14M5 12h14",
  menos: "M5 12h14",
  basura: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  editar: "M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4",
  check: "M5 12l5 5L20 7",
  alerta: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 16v-4m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  descargar: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
  compartir: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  imprimir: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  pausa: "M9 5v14M15 5v14",
  play: "M7 4l13 8-13 8V4Z",
  llave: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7Z",
  ojo: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ojoNo: "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.1 6.1C3.6 7.9 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5-1.4",
  calendario: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4",
  dinero: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
} as const;

export type NombreIcono = keyof typeof RUTAS;

export function Icono({ nombre, className = "size-6" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={RUTAS[nombre]} />
    </svg>
  );
}
