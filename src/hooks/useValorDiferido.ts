/**
 * Devuelve el valor recibido, pero solo cuando deja de cambiar durante `espera` ms.
 * Se usa en los buscadores para no consultar la API con cada letra que se escribe.
 *
 * Ejemplo:
 *   const textoBuscado = useValorDiferido(texto, 300);
 */
"use client";

import { useEffect, useState } from "react";

export function useValorDiferido<T>(valor: T, espera = 300): T {
  const [diferido, setDiferido] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setDiferido(valor), espera);
    return () => clearTimeout(t);
  }, [valor, espera]);

  return diferido;
}
