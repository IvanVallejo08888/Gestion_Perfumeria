/**
 * Igual que `useConsulta`, pero para listas que se cargan por páginas ("Ver más").
 *
 * - Agrega `pagina=N` a la URL. Cuando cambia la URL (un filtro o una búsqueda),
 *   vuelve a empezar desde la página 1.
 * - Descarta las respuestas que llegan tarde de una URL anterior: así una búsqueda
 *   vieja nunca reemplaza a la nueva, y un "Ver más" del filtro anterior no se mezcla
 *   con la lista del filtro actual.
 * - `cargarMas()` no hace nada si ya está cargando o si no hay más páginas
 *   (evita páginas repetidas por doble clic).
 *
 * Ejemplo:
 *   const { items, hayMas, cargarMas } = useConsultaPaginada(
 *     `/api/facturas?${params}`,
 *     (r: { facturas: FacturaResumen[]; hayMas: boolean }) => ({ items: r.facturas, hayMas: r.hayMas }),
 *   );
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/http";

export interface Pagina<T> {
  items: T[];
  hayMas: boolean;
}

interface Opciones {
  /** Se llama cuando una consulta falla (por ejemplo, para mostrar un aviso). */
  alError?: (mensaje: string) => void;
}

export interface ConsultaPaginada<T> {
  /** `null` mientras llega la primera página. */
  items: T[] | null;
  hayMas: boolean;
  error: string;
  /** Cargando la primera página (o recargando por un cambio de URL). */
  cargando: boolean;
  /** Cargando la página siguiente. */
  cargandoMas: boolean;
  cargarMas: () => Promise<void>;
  /** Vuelve a cargar desde la página 1. */
  recargar: () => Promise<void>;
}

function conPagina(url: string, pagina: number) {
  return `${url}${url.includes("?") ? "&" : "?"}pagina=${pagina}`;
}

export function useConsultaPaginada<R, T>(
  url: string | null,
  leer: (respuesta: R) => Pagina<T>,
  opciones: Opciones = {},
): ConsultaPaginada<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(url !== null);
  const [cargandoMas, setCargandoMas] = useState(false);

  // Funciones del componente en una ref: no reinician la consulta en cada dibujo.
  const leerRef = useRef(leer);
  const opcionesRef = useRef(opciones);
  useEffect(() => {
    leerRef.current = leer;
    opcionesRef.current = opciones;
  });

  // Cada cambio de URL (o recarga) abre una "consulta" nueva; las respuestas de las anteriores se ignoran.
  const ultimaRef = useRef(0);
  const paginaRef = useRef(1);
  const ocupadoRef = useRef(false);

  const fallo = useCallback((e: unknown) => {
    const mensaje = (e as Error).message;
    setError(mensaje);
    opcionesRef.current.alError?.(mensaje);
  }, []);

  const cargarPrimera = useCallback(
    async (destino: string) => {
      const id = ++ultimaRef.current;
      ocupadoRef.current = true;
      setCargando(true);
      setCargandoMas(false);
      setError("");
      try {
        const pagina = leerRef.current(await api<R>(conPagina(destino, 1)));
        if (id !== ultimaRef.current) return;
        paginaRef.current = 1;
        setItems(pagina.items);
        setHayMas(pagina.hayMas);
      } catch (e) {
        if (id !== ultimaRef.current) return;
        setItems((previos) => previos ?? []);
        fallo(e);
      } finally {
        if (id === ultimaRef.current) {
          ocupadoRef.current = false;
          setCargando(false);
        }
      }
    },
    [fallo],
  );

  useEffect(() => {
    if (url === null) {
      ultimaRef.current++; // descarta cualquier respuesta pendiente
      ocupadoRef.current = false;
      setCargando(false);
      return;
    }
    cargarPrimera(url);
  }, [url, cargarPrimera]);

  const cargarMas = useCallback(async () => {
    if (url === null || ocupadoRef.current || !hayMas) return;
    const id = ultimaRef.current;
    const siguiente = paginaRef.current + 1;
    ocupadoRef.current = true;
    setCargandoMas(true);
    try {
      const pagina = leerRef.current(await api<R>(conPagina(url, siguiente)));
      if (id !== ultimaRef.current) return;
      paginaRef.current = siguiente;
      setItems((previos) => [...(previos ?? []), ...pagina.items]);
      setHayMas(pagina.hayMas);
    } catch (e) {
      if (id !== ultimaRef.current) return;
      fallo(e);
    } finally {
      if (id === ultimaRef.current) {
        ocupadoRef.current = false;
        setCargandoMas(false);
      }
    }
  }, [url, hayMas, fallo]);

  const recargar = useCallback(async () => {
    if (url !== null) await cargarPrimera(url);
  }, [url, cargarPrimera]);

  return { items, hayMas, error, cargando, cargandoMas, cargarMas, recargar };
}
