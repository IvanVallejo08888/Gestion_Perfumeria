/**
 * Componentes visuales pequeños y reutilizables:
 * Tarjeta, Insignia (estado), Mensaje (alerta en línea), EncabezadoPagina, Cargando y Vacio.
 */
import type { ReactNode } from "react";
import { Icono, type NombreIcono } from "./Icono";

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-linea bg-white p-4 shadow-sm shadow-marca-700/5 sm:p-6 ${className}`}>{children}</section>;
}

type Tono = "exito" | "alerta" | "peligro" | "info" | "neutro" | "marca";

const TONOS: Record<Tono, string> = {
  exito: "bg-exito-50 text-exito-800 border-exito-700",
  alerta: "bg-alerta-50 text-alerta-800 border-alerta-700",
  peligro: "bg-peligro-50 text-peligro-800 border-peligro-700",
  info: "bg-info-50 text-info-800 border-info-700",
  neutro: "bg-superficie-apagada text-texto border-borde",
  marca: "bg-marca-50 text-marca-800 border-marca-700",
};

/** Etiqueta de estado. Siempre lleva TEXTO (el color solo refuerza el mensaje). */
export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-3 py-0.5 text-base font-bold whitespace-nowrap ${TONOS[tono]}`}>
      {children}
    </span>
  );
}

const ICONO_TONO: Record<Tono, NombreIcono> = {
  exito: "check",
  alerta: "alerta",
  peligro: "alerta",
  info: "info",
  neutro: "info",
  marca: "info",
};

/** Mensaje destacado dentro de la página (errores, advertencias, confirmaciones). */
export function Mensaje({ tono = "info", titulo, children }: { tono?: Tono; titulo?: string; children?: ReactNode }) {
  return (
    <div role={tono === "peligro" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border-2 p-4 text-lg ${TONOS[tono]}`}>
      <Icono nombre={ICONO_TONO[tono]} className="mt-0.5 size-7" />
      <div>
        {titulo && <p className="font-bold">{titulo}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-texto sm:text-4xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-lg text-texto-suave">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </div>
  );
}

export function Cargando({ texto = "Cargando información…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-lg font-bold text-texto-suave">
      <span className="size-7 animate-spin rounded-full border-4 border-marca-700 border-t-transparent" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function Vacio({ icono = "info", titulo, children }: { icono?: NombreIcono; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-linea-fuerte bg-white px-4 py-12 text-center">
      <Icono nombre={icono} className="size-12 text-texto-tenue" />
      <p className="text-xl font-bold">{titulo}</p>
      {children && <div className="text-lg text-texto-suave">{children}</div>}
    </div>
  );
}

/** Dato con etiqueta (para mostrar detalles en forma de lista). */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-base font-bold text-texto-suave">{etiqueta}</dt>
      <dd className="text-lg text-texto">{children}</dd>
    </div>
  );
}
