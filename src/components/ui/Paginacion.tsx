/**
 * Paginación grande y accesible:  ← Anterior  1 2 3 … 7  Siguiente →
 *  - Debajo, el texto "Página 2 de 7 · 64 clientes".
 *  - La página activa lleva aria-current="page" (y se ve rellena, no solo por color).
 *  - Con "hrefDe" usa enlaces (la página queda en la URL y el botón Atrás funciona);
 *    con "onIr" usa botones (para listas dentro de una ventana o de un detalle).
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { numerosPagina } from "@/lib/paginacion";

interface Props {
  pagina: number;
  totalPaginas: number;
  total: number;
  /** Nombre de lo que se cuenta, en plural y singular: ["clientes", "cliente"]. */
  nombres: [plural: string, singular: string];
  hrefDe?: (pagina: number) => string;
  onIr?: (pagina: number) => void;
  /** Texto para lectores de pantalla: "Páginas de clientes". */
  etiqueta: string;
}

const claseBase = "inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 px-3 text-lg font-bold";

export function Paginacion({ pagina, totalPaginas, total, nombres, hrefDe, onIr, etiqueta }: Props) {
  /** Botón o enlace según el modo; desactivado = texto sin acción. */
  function control(
    destino: number,
    children: ReactNode,
    { actual = false, desactivado = false, etiquetaAccesible }: { actual?: boolean; desactivado?: boolean; etiquetaAccesible?: string } = {},
  ) {
    const clase = `${claseBase} ${
      actual
        ? "border-marca-700 bg-marca-700 text-white"
        : desactivado
          ? "cursor-not-allowed border-linea-fuerte text-texto-tenue"
          : "border-marca-700 bg-tarjeta text-acento hover:bg-marca-50"
    }`;
    if (desactivado) {
      return (
        <span className={clase} aria-disabled="true">
          {children}
        </span>
      );
    }
    if (hrefDe) {
      return (
        <Link href={hrefDe(destino)} className={clase} aria-current={actual ? "page" : undefined} aria-label={etiquetaAccesible}>
          {children}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onIr?.(destino)} className={clase} aria-current={actual ? "page" : undefined} aria-label={etiquetaAccesible}>
        {children}
      </button>
    );
  }

  return (
    <nav aria-label={etiqueta} className="mt-6 flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {control(pagina - 1, "← Anterior", { desactivado: pagina <= 1 })}
        </li>
        {numerosPagina(pagina, totalPaginas).map((n, i) =>
          n === "…" ? (
            <li key={`puntos-${i}`} aria-hidden="true" className="px-1 text-lg font-bold text-texto-suave">
              …
            </li>
          ) : (
            <li key={n}>
              {control(n, n, { actual: n === pagina, etiquetaAccesible: `Página ${n}` })}
            </li>
          ),
        )}
        <li>
          {control(pagina + 1, "Siguiente →", { desactivado: pagina >= totalPaginas })}
        </li>
      </ul>
      <p className="text-lg font-bold text-texto-suave" aria-live="polite">
        Página {pagina} de {totalPaginas} · {total} {total === 1 ? nombres[1] : nombres[0]}
      </p>
    </nav>
  );
}
