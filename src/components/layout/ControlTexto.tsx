/**
 * Botones para cambiar el tamaño de la letra de TODA la aplicación.
 * La preferencia se guarda en el dispositivo y se sincroniza con la barra de Ajustes (useTamanoTexto).
 */
"use client";

import { useTamanoTexto, type NivelTexto } from "@/hooks/usePreferencias";

const OPCIONES: { valor: NivelTexto; etiqueta: string; descripcion: string; clase: string }[] = [
  { valor: "normal", etiqueta: "A", descripcion: "Letra normal", clase: "text-base" },
  { valor: "grande", etiqueta: "A+", descripcion: "Letra grande", clase: "text-lg" },
  { valor: "muy-grande", etiqueta: "A++", descripcion: "Letra muy grande", clase: "text-xl" },
];

export function ControlTexto({ claro = false }: { claro?: boolean }) {
  const { nivel, cambiar } = useTamanoTexto();

  return (
    <div role="group" aria-label="Tamaño de la letra" className="flex items-center gap-1">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => cambiar(o.valor)}
          aria-pressed={nivel === o.valor}
          title={o.descripcion}
          className={`min-h-11 min-w-11 rounded-lg border-2 px-2 font-bold ${o.clase} ${
            nivel === o.valor
              ? claro
                ? "border-white bg-white text-menu"
                : "border-marca-700 bg-marca-700 text-white"
              : claro
                ? "border-white/60 text-white hover:bg-white/10"
                : "border-borde bg-tarjeta text-texto hover:bg-superficie"
          }`}
        >
          <span aria-hidden="true">{o.etiqueta}</span>
          <span className="sr-only">{o.descripcion}</span>
        </button>
      ))}
    </div>
  );
}
