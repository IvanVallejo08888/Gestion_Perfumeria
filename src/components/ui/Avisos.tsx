/**
 * Avisos flotantes ("toasts") que confirman acciones: "Factura registrada", "Error al guardar"…
 * Se anuncian automáticamente a lectores de pantalla (aria-live). Los de éxito e información
 * duran 8 segundos; los de error se quedan hasta que la persona los cierra.
 */
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icono } from "./Icono";

type TipoAviso = "exito" | "error" | "info";
interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

const ContextoAvisos = createContext<(tipo: TipoAviso, texto: string) => void>(() => {});

export function useAvisos() {
  const mostrar = useContext(ContextoAvisos);
  return {
    exito: (texto: string) => mostrar("exito", texto),
    error: (texto: string) => mostrar("error", texto),
    info: (texto: string) => mostrar("info", texto),
  };
}

/** Confirmaciones e información: 8 s, tiempo suficiente para leer con calma. */
const DURACION_MS = 8000;

const ESTILOS: Record<TipoAviso, string> = {
  exito: "border-exito-700 bg-exito-50 text-exito-800",
  error: "border-peligro-700 bg-peligro-50 text-peligro-800",
  info: "border-info-700 bg-info-50 text-info-800",
};

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const cerrar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const mostrar = useCallback(
    (tipo: TipoAviso, texto: string) => {
      const id = Date.now() + Math.random();
      setAvisos((lista) => [...lista.slice(-2), { id, tipo, texto }]);
      // Los errores NO desaparecen solos (WCAG 2.2.1): la persona los cierra cuando termine de leerlos
      if (tipo !== "error") setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );

  return (
    <ContextoAvisos.Provider value={mostrar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[200] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border-2 px-4 py-3 text-lg font-bold shadow-lg ${ESTILOS[a.tipo]}`}
          >
            <Icono nombre={a.tipo === "exito" ? "check" : a.tipo === "error" ? "alerta" : "info"} className="mt-0.5 size-6" />
            <p className="flex-1">{a.texto}</p>
            {/* Área táctil de 44 px (WCAG 2.5.5), aunque el ícono sea pequeño */}
            <button
              type="button"
              onClick={() => cerrar(a.id)}
              className="-my-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/10"
              aria-label="Cerrar aviso"
            >
              <Icono nombre="cerrar" className="size-6" />
            </button>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}
