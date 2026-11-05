/**
 * Ventana emergente accesible basada en <dialog>:
 * - Atrapa el foco del teclado dentro de la ventana.
 * - Se cierra con la tecla Esc o con el botón "Cerrar" (grande y visible).
 * - En celular ocupa casi toda la pantalla; en computador se centra.
 */
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icono } from "./Icono";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Ancho máximo en computador */
  tamano?: "md" | "lg" | "xl";
}

const ANCHOS = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

export function Modal({ abierto, onCerrar, titulo, children, tamano = "md" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        // Clic en el fondo oscuro cierra la ventana
        if (e.target === ref.current) onCerrar();
      }}
      className={`m-auto max-h-[94dvh] w-[96vw] ${ANCHOS[tamano]} rounded-2xl bg-white p-0 text-texto shadow-2xl backdrop:bg-black/60`}
    >
      {abierto && (
        <div className="flex max-h-[94dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b-2 border-gray-200 px-5 py-4">
            <h2 id={tituloId} className="text-2xl font-bold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-lg font-bold text-texto-suave hover:bg-gray-100"
            >
              <Icono nombre="cerrar" />
              Cerrar
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Ventana de confirmación para acciones importantes (eliminar, pausar…). */
export function Confirmar({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Sí, continuar",
  peligro = false,
  cargando = false,
  onConfirmar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: ReactNode;
  textoConfirmar?: string;
  peligro?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <div className="text-lg">{mensaje}</div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-12 rounded-xl border-2 border-borde bg-white px-5 text-lg font-bold hover:bg-gray-50"
        >
          No, cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={cargando}
          className={`min-h-12 rounded-xl px-5 text-lg font-bold text-white disabled:opacity-60 ${
            peligro ? "bg-peligro-700 hover:bg-peligro-800" : "bg-marca-700 hover:bg-marca-800"
          }`}
        >
          {cargando ? "Un momento…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
