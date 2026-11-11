/**
 * Grupo de botones para elegir UNA opción (filtros como «Todas / Pendientes / Completadas»).
 * - Cada botón indica si está activo con aria-pressed (y con color + borde, nunca solo color).
 * - Mismo aspecto en todas las pantallas: antes cada página lo dibujaba a su manera.
 *
 * También exporta `moverConFlechas`, para pestañas (role="tab") y opciones (role="radio"):
 * las flechas, Inicio y Fin mueven la selección, como esperan los lectores de pantalla.
 */
"use client";

import type { KeyboardEvent } from "react";

interface Opcion<T extends string> {
  valor: T;
  texto: string;
}

interface Props<T extends string> {
  /** Nombre del grupo para lectores de pantalla ("Filtrar por estado"). */
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  onCambio: (valor: T) => void;
}

export function GrupoOpciones<T extends string>({ etiqueta, opciones, valor, onCambio }: Props<T>) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activa = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onCambio(o.valor)}
            aria-pressed={activa}
            className={`min-h-12 rounded-xl border-2 px-4 text-lg font-bold transition-colors ${
              activa ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-tarjeta text-texto hover:bg-marca-50"
            }`}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Navegación con teclado para pestañas y grupos de opciones (patrón WAI-ARIA).
 * Llama a `elegir` con el nuevo índice y mueve el foco al botón correspondiente.
 */
export function moverConFlechas(e: KeyboardEvent<HTMLElement>, indice: number, total: number, elegir: (i: number) => void) {
  const destinos: Record<string, number> = {
    ArrowRight: (indice + 1) % total,
    ArrowDown: (indice + 1) % total,
    ArrowLeft: (indice - 1 + total) % total,
    ArrowUp: (indice - 1 + total) % total,
    Home: 0,
    End: total - 1,
  };
  const destino = destinos[e.key];
  if (destino === undefined) return;
  e.preventDefault();
  elegir(destino);
  const hermanos = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=tab],[role=radio]");
  hermanos?.[destino]?.focus();
}
