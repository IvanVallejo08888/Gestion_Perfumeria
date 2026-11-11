/**
 * Inventario de HOY dentro del dashboard:
 *  - Unidades en stock por género (Hombre, Niño, Mujer, Niña).
 *  - Perfumes agotados o en stock bajo, los más urgentes primero.
 *    El vendedor puede «Agregar unidades» ahí mismo; el administrador solo consulta.
 */
"use client";

import Link from "next/link";
import { Boton } from "@/components/ui/Boton";
import { InsigniaStock } from "@/components/inventario/ListaProductos";
import type { Dashboard, ProductoCritico } from "@/tipos";
import { BarrasHorizontales, TarjetaGrafica } from "./Graficas";

interface Props {
  inventario: Dashboard["inventario"];
  /** Solo el vendedor (en su propio local) puede sumar unidades desde aquí. */
  onAgregarUnidades?: (producto: ProductoCritico) => void;
}

const ENLACE = "inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-marca-700 px-4 text-lg font-bold text-marca-800 hover:bg-marca-50";

export function InventarioDashboard({ inventario, onAgregarUnidades }: Props) {
  const { porPublico, criticos, totalCriticos } = inventario;
  const hayStock = porPublico.some((p) => p.unidades > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TarjetaGrafica titulo="Unidades en stock por género" descripcion="Lo que hay hoy en el inventario." vacio={!hayStock} textoVacio="Aún no hay perfumes en el inventario">
        <BarrasHorizontales
          titulo="Unidades en stock por género"
          columna="Género"
          filas={porPublico.map((p) => ({
            clave: p.clave,
            etiqueta: p.etiqueta,
            valor: p.unidades,
            textoValor: String(p.unidades),
            detalle: [["Unidades en stock", String(p.unidades)]],
            tenue: p.clave === "SIN_CATEGORIA",
          }))}
        />
      </TarjetaGrafica>

      <TarjetaGrafica
        titulo="Stock bajo o agotado"
        descripcion={totalCriticos ? `${totalCriticos} ${totalCriticos === 1 ? "perfume necesita" : "perfumes necesitan"} unidades.` : undefined}
        vacio={criticos.length === 0}
        textoVacio="Todo el inventario tiene unidades suficientes"
      >
        <ul className="divide-y-2 divide-linea">
          {criticos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-lg font-bold break-words">{p.nombre}</p>
                <p className="text-base text-texto-suave">
                  {[p.localNombre, p.marcaNombre].filter(Boolean).join(" · ") || "Sin marca"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-lg">
                  <span>
                    Quedan <strong>{p.stock}</strong> (mínimo {p.stockMinimo})
                  </span>
                  <InsigniaStock stock={p.stock} stockMinimo={p.stockMinimo} />
                </p>
              </div>
              {onAgregarUnidades && (
                <Boton icono="mas" className="w-full sm:w-auto" onClick={() => onAgregarUnidades(p)} aria-label={`Agregar unidades a ${p.nombre}`}>
                  Agregar unidades
                </Boton>
              )}
            </li>
          ))}
        </ul>
        {totalCriticos > criticos.length && (
          <p className="mt-3 text-base text-texto-suave">
            Se muestran los {criticos.length} más urgentes de {totalCriticos}.
          </p>
        )}
        {onAgregarUnidades && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/panel/inventario?stock=AGOTADO" className={ENLACE}>
              Ver agotados
            </Link>
            <Link href="/panel/inventario?stock=BAJO" className={ENLACE}>
              Ver stock bajo
            </Link>
          </div>
        )}
      </TarjetaGrafica>
    </div>
  );
}
