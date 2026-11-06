"use client";

import { Boton } from "@/components/ui/Boton";

/**
 * El service worker muestra esta página sin cambiar la dirección, así que al recargar se
 * vuelve a pedir la pantalla que la persona quería abrir. Si llegó directo a /offline,
 * se la lleva al inicio.
 */
function reintentar() {
  if (window.location.pathname === "/offline") window.location.href = "/";
  else window.location.reload();
}

export function BotonReintentar() {
  return (
    <Boton ancho icono="historial" onClick={reintentar}>
      Reintentar
    </Boton>
  );
}
