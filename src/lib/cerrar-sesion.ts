/**
 * Cierre de sesión desde el navegador (menú y Ajustes usan esta misma función).
 * - Borra el borrador de factura: lleva datos del cliente y no debe quedar en el equipo.
 * - Quita los avisos de cobro: en un dispositivo compartido, el siguiente vendedor no debe verlos.
 */
import { borrarBorradorFactura } from "./borrador-factura";
import { api } from "./http";

/** Etiqueta de los avisos de cobro: cada aviso reemplaza al anterior en vez de acumularse. */
export const ETIQUETA_COBRO = "recordatorio-cobro";

export async function cerrarSesion() {
  borrarBorradorFactura();
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  await cerrarNotificaciones().catch(() => {});
  window.location.href = "/login";
}

async function cerrarNotificaciones() {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.getRegistration();
  const avisos = await registro?.getNotifications({ tag: ETIQUETA_COBRO });
  avisos?.forEach((aviso) => aviso.close());
}
