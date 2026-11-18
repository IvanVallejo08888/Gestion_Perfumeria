/**
 * Preferencias de apariencia guardadas en ESTE dispositivo (localStorage):
 *  - Tamaño de letra: atributo data-texto en <html> y clave "tamano-texto".
 *  - Tema: atributo data-tema ("claro" | "oscuro") en <html> y clave "tema" ("claro" | "oscuro" | "sistema").
 * El script temprano de app/layout.tsx aplica ambas ANTES de pintar (sin saltos ni parpadeo) y sigue
 * los cambios del sistema cuando el tema es "sistema". Estos hooks solo leen y cambian esa misma fuente,
 * por eso los botones A/A+/A++ del inicio de sesión y la barra de Ajustes quedan siempre sincronizados.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

/* ------------------------------- Tamaño de letra ------------------------------- */

export const NIVELES_TEXTO = [
  { valor: "normal", etiqueta: "Normal" },
  { valor: "grande", etiqueta: "Grande" },
  { valor: "muy-grande", etiqueta: "Muy grande" },
] as const;

export type NivelTexto = (typeof NIVELES_TEXTO)[number]["valor"];

const CLAVE_TEXTO = "tamano-texto";
const EVENTO_TEXTO = "preferencias:texto";

function leerNivel(): NivelTexto {
  const actual = document.documentElement.dataset.texto;
  return NIVELES_TEXTO.some((n) => n.valor === actual) ? (actual as NivelTexto) : "normal";
}

export function useTamanoTexto() {
  const [nivel, setNivel] = useState<NivelTexto>("normal");

  useEffect(() => {
    const leer = () => setNivel(leerNivel());
    leer();
    window.addEventListener(EVENTO_TEXTO, leer);
    return () => window.removeEventListener(EVENTO_TEXTO, leer);
  }, []);

  const cambiar = useCallback((valor: NivelTexto) => {
    if (valor === "normal") delete document.documentElement.dataset.texto;
    else document.documentElement.dataset.texto = valor;
    try {
      localStorage.setItem(CLAVE_TEXTO, valor);
    } catch {
      /* almacenamiento no disponible: el cambio aplica solo a esta visita */
    }
    window.dispatchEvent(new Event(EVENTO_TEXTO));
  }, []);

  return { nivel, cambiar };
}

/* ------------------------------------- Tema ------------------------------------- */

export type PreferenciaTema = "claro" | "oscuro" | "sistema";
export type Tema = "claro" | "oscuro";

const CLAVE_TEMA = "tema";
const EVENTO_TEMA = "preferencias:tema";
const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

function leerPreferencia(): PreferenciaTema {
  try {
    const guardada = localStorage.getItem(CLAVE_TEMA);
    if (guardada === "oscuro" || guardada === "sistema") return guardada;
  } catch {
    /* sin almacenamiento: tema claro */
  }
  return "claro";
}

/** Tema que se ve ahora mismo (ya resuelto "sistema"): lo usan las gráficas para elegir colores. */
export function useTemaActual(): Tema {
  const [tema, setTema] = useState<Tema>("claro");
  useEffect(() => {
    const html = document.documentElement;
    const leer = () => setTema(html.dataset.tema === "oscuro" ? "oscuro" : "claro");
    leer();
    const observador = new MutationObserver(leer);
    observador.observe(html, { attributes: true, attributeFilter: ["data-tema"] });
    return () => observador.disconnect();
  }, []);
  return tema;
}

/** Preferencia elegida (claro / oscuro / según el dispositivo) y función para cambiarla. */
export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>("claro");

  useEffect(() => {
    const leer = () => setPreferencia(leerPreferencia());
    leer();
    window.addEventListener(EVENTO_TEMA, leer);
    return () => window.removeEventListener(EVENTO_TEMA, leer);
  }, []);

  const cambiar = useCallback((valor: PreferenciaTema) => {
    try {
      localStorage.setItem(CLAVE_TEMA, valor);
    } catch {
      /* sin almacenamiento: el cambio aplica solo a esta visita */
    }
    const oscuro = valor === "oscuro" || (valor === "sistema" && window.matchMedia(CONSULTA_OSCURO).matches);
    document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }, []);

  return { preferencia, cambiar };
}
