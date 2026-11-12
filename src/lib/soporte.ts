/**
 * Mensaje y enlaces para escribirle al desarrollador (Ajustes → Quejas e inquietudes).
 * Funciones puras (sin navegador ni base de datos), por eso tienen pruebas unitarias.
 * El mensaje lleva lo que escribió el usuario + datos técnicos que ayudan a encontrar el problema.
 */
import { fechaHora } from "./formato";
import { PANTALLAS_QUEJA, TIPOS_QUEJA, type Queja } from "./validaciones";
import { numeroWhatsApp, plano } from "./whatsapp";

export interface DatosTecnicos {
  nombre: string;
  rol: "ADMIN" | "VENDEDOR";
  /** Nombre del local (null para el administrador, que ve todos). */
  local: string | null;
  fecha: Date;
  /** navigator.userAgent */
  agente: string;
  ancho: number;
  alto: number;
}

/** Resume el userAgent en algo legible: «Chrome 131 · Android». */
export function describirNavegador(agente: string): string {
  const version = (regla: RegExp) => agente.match(regla)?.[1];
  let navegador = "Navegador desconocido";
  const edge = version(/Edg(?:A|iOS)?\/(\d+)/);
  const firefox = version(/(?:Firefox|FxiOS)\/(\d+)/);
  const samsung = version(/SamsungBrowser\/(\d+)/);
  const chrome = version(/(?:Chrome|CriOS)\/(\d+)/);
  const safari = version(/Version\/(\d+)[\d.]* .*Safari/);
  if (edge) navegador = `Edge ${edge}`;
  else if (firefox) navegador = `Firefox ${firefox}`;
  else if (samsung) navegador = `Samsung Internet ${samsung}`;
  else if (chrome) navegador = `Chrome ${chrome}`;
  else if (safari) navegador = `Safari ${safari}`;

  const sistema = /Android/.test(agente)
    ? "Android"
    : /iPhone|iPad|iPod/.test(agente)
      ? "iOS"
      : /Windows/.test(agente)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(agente)
          ? "macOS"
          : /Linux/.test(agente)
            ? "Linux"
            : "Sistema desconocido";
  return `${navegador} · ${sistema}`;
}

const textoTipo = (tipo: Queja["tipo"]) => TIPOS_QUEJA.find((t) => t.valor === tipo)?.texto ?? tipo;
const textoPantalla = (id: string) => PANTALLAS_QUEJA.find((p) => p.id === id)?.nombre ?? id;

export function asuntoSoporte(queja: Queja): string {
  return `${textoTipo(queja.tipo)} en ${textoPantalla(queja.pantalla)} · Gestión de Perfumerías`;
}

export function mensajeSoporte(queja: Queja, datos: DatosTecnicos): string {
  const separador = "———";
  return [
    "*Soporte · Gestión de Perfumerías*",
    `Tipo: ${textoTipo(queja.tipo)}`,
    `Pantalla: ${textoPantalla(queja.pantalla)}`,
    separador,
    queja.descripcion.trim(),
    separador,
    "Datos técnicos:",
    `• Usuario: ${datos.nombre} (${datos.rol === "ADMIN" ? "Administrador" : "Vendedor"})`,
    `• Local: ${datos.local ?? "Administrador (todos los locales)"}`,
    `• Fecha: ${plano(fechaHora(datos.fecha))}`,
    `• Navegador: ${describirNavegador(datos.agente)}`,
    `• Pantalla: ${datos.ancho} × ${datos.alto} px`,
  ].join("\n");
}

/** Enlace wa.me al número de soporte, o null si el número no está configurado o no es válido. */
export function enlaceWhatsAppSoporte(telefono: string | undefined, mensaje: string): string | null {
  const numero = telefono ? numeroWhatsApp(telefono) : null;
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}

/** Enlace mailto: al correo de soporte, o null si el correo no está configurado o no es válido. */
export function enlaceCorreoSoporte(correo: string | undefined, asunto: string, mensaje: string): string | null {
  const limpio = correo?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return null;
  return `mailto:${limpio}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
}
