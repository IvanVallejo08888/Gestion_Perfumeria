/**
 * Pestañas accesibles (patrón WAI-ARIA tablist / tab / tabpanel).
 * - Las pestañas se acomodan en una cuadrícula que crece hacia abajo: nunca hay scroll horizontal.
 * - Solo la pestaña activa entra en el orden de Tab; las flechas, Inicio y Fin cambian de pestaña.
 * - La activa se distingue por color, borde grueso y un ícono de chulo (no solo por color).
 */
"use client";

import { useId, type ReactNode } from "react";
import { moverConFlechas } from "./GrupoOpciones";
import { Icono } from "./Icono";

interface Pestana {
  id: string;
  titulo: string;
}

interface Props {
  /** Nombre del grupo para lectores de pantalla. */
  etiqueta: string;
  pestanas: readonly Pestana[];
  activa: string;
  onCambio: (id: string) => void;
  children: ReactNode;
}

export function Pestanas({ etiqueta, pestanas, activa, onCambio, children }: Props) {
  const base = useId();
  const idPestana = (id: string) => `${base}-pestana-${id}`;
  const idPanel = `${base}-panel`;

  return (
    <div>
      <div role="tablist" aria-label={etiqueta} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pestanas.map((p, i) => {
          const esActiva = p.id === activa;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={idPestana(p.id)}
              aria-selected={esActiva}
              aria-controls={idPanel}
              tabIndex={esActiva ? 0 : -1}
              onKeyDown={(e) => moverConFlechas(e, i, pestanas.length, (j) => onCambio(pestanas[j].id))}
              onClick={() => onCambio(p.id)}
              className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-lg font-bold transition-colors ${
                esActiva ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-tarjeta text-texto hover:bg-marca-50"
              }`}
            >
              {esActiva && <Icono nombre="check" className="size-5 shrink-0" />}
              <span className="min-w-0 break-words">{p.titulo}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={idPanel} aria-labelledby={idPestana(activa)} tabIndex={0} className="mt-4 focus:outline-none">
        {children}
      </div>
    </div>
  );
}
