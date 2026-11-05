/**
 * Ejecuta una función cada `ms` milisegundos mientras `activo` sea verdadero.
 * Con `alVolver`, también la ejecuta cuando la persona regresa a la pestaña.
 *
 * La función siempre es la más reciente (no hace falta envolverla en useCallback).
 *
 * Ejemplo:
 *   useIntervalo(recargar, 60_000, { alVolver: true });
 */
"use client";

import { useEffect, useRef } from "react";

interface Opciones {
  /** Si es falso, no se programa nada. Por defecto: verdadero. */
  activo?: boolean;
  /** Ejecutar también al volver a la pestaña. Por defecto: falso. */
  alVolver?: boolean;
}

export function useIntervalo(fn: () => unknown, ms: number, { activo = true, alVolver = false }: Opciones = {}) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => fnRef.current(), ms);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") fnRef.current();
    };
    if (alVolver) document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearInterval(id);
      if (alVolver) document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [ms, activo, alVolver]);
}
