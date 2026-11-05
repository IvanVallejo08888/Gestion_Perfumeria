/**
 * Aviso interno de "algo cambió que puede afectar las notificaciones"
 * (una venta, un abono, un cambio de stock o de fecha de cobro).
 *
 * - `avisarCambioNotificaciones()`: llámala después de guardar.
 * - `useAlCambiarNotificaciones(fn)`: ejecuta `fn` cada vez que alguien avisa.
 */
"use client";

import { useEffect, useRef } from "react";

const EVENTO = "notificaciones:actualizar";

export function avisarCambioNotificaciones() {
  window.dispatchEvent(new Event(EVENTO));
}

export function useAlCambiarNotificaciones(fn: () => unknown, activo = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!activo) return;
    const manejar = () => fnRef.current();
    window.addEventListener(EVENTO, manejar);
    return () => window.removeEventListener(EVENTO, manejar);
  }, [activo]);
}
