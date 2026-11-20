/**
 * Avisos flotantes ("toasts") que confirman acciones: "Factura registrada", "Error al guardar"…
 * Se anuncian automáticamente a lectores de pantalla (aria-live). Los de éxito e información
 * duran 8 segundos; los de error se quedan hasta que la persona los cierra.
 * En celular salen ABAJO y más compactos, para no tapar el encabezado ni el contenido;
 * desde tableta (sm) salen arriba a la derecha, como siempre.
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
        className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2 sm:inset-x-auto sm:top-16 sm:right-4 sm:bottom-auto sm:items-end"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border-2 py-1 pr-1 pl-3 text-base font-bold shadow-lg sm:items-start sm:gap-3 sm:px-4 sm:py-3 sm:text-lg ${ESTILOS[a.tipo]}`}
          >
            <Icono nombre={a.tipo === "exito" ? "check" : a.tipo === "error" ? "alerta" : "info"} className="size-5 shrink-0 sm:mt-0.5 sm:size-6" />
            <p className="flex-1">{a.texto}</p>
            {/* Área táctil de 48 px, aunque el ícono sea pequeño */}
            <button
              type="button"
              onClick={() => cerrar(a.id)}
              className="flex size-12 shrink-0 items-center justify-center rounded-lg hover:bg-marca-50 sm:-my-2 sm:-mr-2"
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
