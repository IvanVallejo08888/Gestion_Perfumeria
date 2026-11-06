/**
 * Sección desplegable accesible: un botón de ancho completo que muestra u oculta su contenido.
 * - Usa aria-expanded y aria-controls; al ser un <button> funciona con Enter y Espacio.
 * - "resumen" se ve siempre en el encabezado, aunque la sección esté cerrada.
 * - La flecha solo gira con animación si la persona no pidió reducir el movimiento.
 * - El contenido se conserva al cerrar: lo escrito no se pierde.
 */
"use client";

import { useId, useState, type ReactNode } from "react";
import { Icono } from "./Icono";

interface Props {
  titulo: string;
  /** Texto corto con el valor actual (por ejemplo, "− $ 10.000"). */
  resumen?: string;
  children: ReactNode;
}

export function Desplegable({ titulo, resumen, children }: Props) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();

  return (
    <section className="rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={panelId}
          onClick={() => setAbierto((a) => !a)}
          className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-xl font-bold hover:bg-marca-50 sm:px-6"
        >
          <span>
            {titulo}
            {/* El valor no se parte en dos líneas: el signo siempre queda junto al monto */}
            {resumen && <span className="whitespace-nowrap text-marca-800"> · {resumen}</span>}
          </span>
          <Icono
            nombre="flechaAbajo"
            className={`size-7 transition-transform motion-reduce:transition-none ${abierto ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div id={panelId} hidden={!abierto} className="px-4 pb-5 sm:px-6">
        {children}
      </div>
    </section>
  );
}
