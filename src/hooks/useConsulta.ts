/**
 * Carga datos de la API (GET) y expone su estado: datos, error y si está cargando.
 *
 * - Si la URL es `null`, no consulta (útil para esperar a que haya un id o un filtro).
 * - Cada vez que cambia la URL vuelve a consultar; si llega una respuesta vieja
 *   (de una URL anterior) se descarta, así nunca se muestran datos mezclados.
 * - Mientras recarga conserva los datos anteriores (la pantalla no "parpadea").
 * - `recargar()` vuelve a pedir los datos (por ejemplo, después de guardar).
 *
 * Ejemplo:
 *   const { datos, error, cargando, recargar } = useConsulta<{ locales: Local[] }>("/api/admin/locales");
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/http";

interface Opciones<T> {
  /** Se llama cuando la consulta falla (por ejemplo, para mostrar un aviso). */
  alError?: (mensaje: string) => void;
  /** Se llama cada vez que llegan datos nuevos. */
  alCargar?: (datos: T) => void;
}

export interface Consulta<T> {
  datos: T | null;
  /** URL de la que vienen `datos` (puede ser una anterior mientras se carga la nueva). */
  urlDatos: string | null;
  error: string;
  cargando: boolean;
  /** Vuelve a consultar la misma URL. La promesa termina cuando llegan los datos. */
  recargar: () => Promise<void>;
}

export function useConsulta<T>(url: string | null, opciones: Opciones<T> = {}): Consulta<T> {
  const [{ datos, urlDatos }, setDatos] = useState<{ datos: T | null; urlDatos: string | null }>({ datos: null, urlDatos: null });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(url !== null);

  // Las funciones de opciones se guardan en una ref para no reiniciar la consulta
  // cada vez que el componente se vuelve a dibujar.
  const opcionesRef = useRef(opciones);
  useEffect(() => {
    opcionesRef.current = opciones;
  });

  // Identifica la consulta más reciente; las respuestas de consultas anteriores se ignoran.
  const ultimaRef = useRef(0);

  const consultar = useCallback(async (destino: string) => {
    const id = ++ultimaRef.current;
    setCargando(true);
    setError("");
    try {
      const respuesta = await api<T>(destino);
      if (id !== ultimaRef.current) return;
      setDatos({ datos: respuesta, urlDatos: destino });
      opcionesRef.current.alCargar?.(respuesta);
    } catch (e) {
      if (id !== ultimaRef.current) return;
      const mensaje = (e as Error).message;
      setError(mensaje);
      opcionesRef.current.alError?.(mensaje);
    } finally {
      if (id === ultimaRef.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (url === null) {
      ultimaRef.current++; // descarta cualquier respuesta pendiente
      setCargando(false);
      return;
    }
    consultar(url);
  }, [url, consultar]);

  const recargar = useCallback(async () => {
    if (url !== null) await consultar(url);
  }, [url, consultar]);

  return { datos, urlDatos, error, cargando, recargar };
}
