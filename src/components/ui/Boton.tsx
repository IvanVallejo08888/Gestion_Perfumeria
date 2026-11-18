/**
 * Botón accesible: mínimo 48px de alto, texto grande y estado "cargando" que evita doble clic.
 */
"use client";

import type { ButtonHTMLAttributes } from "react";
import { Icono, type NombreIcono } from "./Icono";

type Variante = "primario" | "secundario" | "peligro" | "exito" | "fantasma";

const ESTILOS: Record<Variante, string> = {
  primario: "bg-marca-700 text-white hover:bg-marca-800 active:bg-marca-900 border-2 border-marca-700",
  secundario: "bg-tarjeta text-acento border-2 border-marca-700 hover:bg-marca-50",
  peligro: "bg-peligro-700 text-white border-2 border-peligro-700 hover:bg-peligro-800",
  exito: "bg-exito-700 text-white border-2 border-exito-700 hover:bg-exito-800",
  fantasma: "bg-transparent text-texto border-2 border-transparent hover:bg-marca-50",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icono?: NombreIcono;
  cargando?: boolean;
  /** Ocupa todo el ancho disponible */
  ancho?: boolean;
  pequeno?: boolean;
}

export function Boton({
  variante = "primario",
  icono,
  cargando = false,
  ancho = false,
  pequeno = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...resto
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        pequeno ? "min-h-11 px-3 py-1.5 text-base" : "min-h-12 px-5 py-2.5 text-lg",
        ancho ? "w-full" : "",
        ESTILOS[variante],
        className,
      ].join(" ")}
      {...resto}
    >
      {cargando ? (
        <span className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden="true" />
      ) : (
        icono && <Icono nombre={icono} className={pequeno ? "size-5" : "size-6"} />
      )}
      {/* Mientras carga se conserva el texto (la persona sigue sabiendo qué acción se está haciendo) */}
      <span>
        {children}
        {cargando && <span className="sr-only"> — procesando, un momento</span>}
      </span>
    </button>
  );
}
