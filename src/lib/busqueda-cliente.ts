/**
 * Reglas de la búsqueda del cliente por cédula en la factura (compartidas por el navegador y el servidor).
 *  - La cédula se compara y se guarda SOLO con dígitos ("1.080.044.910" = "1080044910").
 *  - Se busca sola cuando hay 6 dígitos o más y la persona deja de escribir 500 ms,
 *    además de al salir del campo o presionar Enter (desde 5 dígitos, el mínimo válido).
 *  - Un error del servidor NO es "cliente nuevo": se avisa para que lo intente de nuevo.
 */
import type { ClienteDatos } from "@/tipos";
import { soloDigitos } from "./formato";

/** Dígitos mínimos para buscar al salir del campo o con Enter (igual que la validación). */
export const MIN_DIGITOS_IDENTIFICACION = 5;
/** Dígitos mínimos para buscar sola mientras se escribe. */
export const MIN_DIGITOS_BUSQUEDA_AUTOMATICA = 6;
/** Pausa al escribir antes de buscar sola. */
export const ESPERA_BUSQUEDA_MS = 500;

/** Respuesta de GET /api/clientes/buscar-identificacion. */
export interface RespuestaBusquedaCliente {
  cliente: ClienteDatos | null;
  /** true si la cédula no está en este local pero sí en otro (sus datos se ofrecen para copiarlos). */
  otroLocal: boolean;
}

export type EstadoBusquedaCliente = "" | "buscando" | "encontrado" | "otro-local" | "copiado" | "nuevo" | "error";

export const normalizarIdentificacion = soloDigitos;

export function puedeBuscarIdentificacion(identificacion: string) {
  return normalizarIdentificacion(identificacion).length >= MIN_DIGITOS_IDENTIFICACION;
}

export function debeBuscarAlEscribir(identificacion: string) {
  return normalizarIdentificacion(identificacion).length >= MIN_DIGITOS_BUSQUEDA_AUTOMATICA;
}

/** Une los dos resultados del servidor: primero el cliente del local; si no hay, el de otro local. */
export function resultadoBusqueda(delLocal: ClienteDatos | null | undefined, deOtroLocal: ClienteDatos | null | undefined): RespuestaBusquedaCliente {
  if (delLocal) return { cliente: delLocal, otroLocal: false };
  if (deOtroLocal) return { cliente: deOtroLocal, otroLocal: true };
  return { cliente: null, otroLocal: false };
}

/** Estado que muestra la factura según lo que respondió el servidor (o si falló). */
export function estadoTrasBuscar(resultado: { ok: true; respuesta: RespuestaBusquedaCliente } | { ok: false }): EstadoBusquedaCliente {
  if (!resultado.ok) return "error";
  const { cliente, otroLocal } = resultado.respuesta;
  if (!cliente) return "nuevo";
  return otroLocal ? "otro-local" : "encontrado";
}

export const AYUDA_IDENTIFICACION: Record<EstadoBusquedaCliente, string> = {
  "": "Escribe la cédula: si el cliente ya está registrado, sus datos se llenan solos.",
  buscando: "Buscando cliente…",
  encontrado: "✔ Cliente encontrado: revisa que sus datos estén al día.",
  "otro-local": "Encontrado en otro local: elige abajo si quieres usar sus datos.",
  copiado: "✔ Datos copiados del otro local: al facturar quedará registrado también en este local.",
  nuevo: "Cliente nuevo: completa sus datos.",
  error: "No se pudo buscar el cliente, intenta de nuevo.",
};
