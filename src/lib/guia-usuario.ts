/**
 * Módulos de la aplicación y textos de la Guía de usuario (pantalla Ajustes).
 * Para escribir la guía basta con cambiar los textos de GUIA_USUARIO: la pantalla no se toca.
 * Cada texto admite varios párrafos separados por una línea en blanco.
 */

export const MODULOS = [
  { id: "facturacion", nombre: "Facturación" },
  { id: "creditos", nombre: "Créditos y abonos" },
  { id: "gastos", nombre: "Gastos" },
  { id: "inventario", nombre: "Inventario" },
  { id: "notificaciones", nombre: "Notificaciones" },
  { id: "reportes", nombre: "Reportes" },
  { id: "usuarios", nombre: "Usuarios", soloAdmin: true },
  { id: "locales", nombre: "Locales", soloAdmin: true },
] as const;

export type IdModulo = (typeof MODULOS)[number]["id"];

export const GUIA_USUARIO: Record<IdModulo, string> = {
  facturacion: "Próximamente",
  creditos: "Próximamente",
  gastos: "Próximamente",
  inventario: "Próximamente",
  notificaciones: "Próximamente",
  reportes: "Próximamente",
  usuarios: "Próximamente",
  locales: "Próximamente",
};

/** Módulos que ve cada rol (Usuarios y Locales son solo del administrador). */
export function modulosPara(rol: "ADMIN" | "VENDEDOR") {
  return MODULOS.filter((m) => rol === "ADMIN" || !("soloAdmin" in m));
}
