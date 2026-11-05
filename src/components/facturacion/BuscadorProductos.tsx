/**
 * Buscador inteligente de productos para la factura.
 * - Busca mientras se escribe (sin importar mayúsculas, tildes ni el orden de las palabras).
 * - Muestra precio y stock disponible de cada producto.
 * - Si no hay stock, muestra una ADVERTENCIA y no permite agregarlo a la venta.
 * - Si el producto ya está en la factura, suma una unidad (sin pasar del stock).
 */
"use client";

import { useId, useRef, useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { pesos } from "@/lib/formato";
import type { ProductoVenta } from "@/tipos";
import { Insignia, Mensaje } from "../ui/Basicos";
import { Icono } from "../ui/Icono";

interface Props {
  /** Devuelve un mensaje de error si no se pudo agregar (por ejemplo, stock insuficiente). */
  onAgregar: (producto: ProductoVenta) => string | null;
  /** Cantidades que ya están en la factura, por id de producto */
  enFactura: Record<string, number>;
}

export function BuscadorProductos({ onAgregar, enFactura }: Props) {
  const [texto, setTexto] = useState("");
  const [advertencia, setAdvertencia] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const idCampo = useId();

  // Búsqueda con una pequeña espera (250 ms) para no consultar con cada letra
  const consulta = texto.trim();
  const diferida = useValorDiferido(consulta, 250);
  const busquedaValida = consulta.length >= 2;
  const urlActual = `/api/productos/buscar?q=${encodeURIComponent(consulta)}`;
  const { datos, urlDatos, error, cargando } = useConsulta<{ productos: ProductoVenta[] }>(
    diferida.length >= 2 ? `/api/productos/buscar?q=${encodeURIComponent(diferida)}` : null,
  );
  // Solo se muestran resultados que correspondan EXACTAMENTE a lo escrito
  // (así Enter nunca agrega un producto de una búsqueda anterior).
  const buscado = busquedaValida && !error && urlDatos === urlActual;
  const resultados = buscado ? (datos?.productos ?? []) : [];
  const buscando = busquedaValida && !error && (cargando || urlDatos !== urlActual);

  function elegir(p: ProductoVenta) {
    if (p.stock <= 0) {
      setAdvertencia(`No hay stock de «${p.nombre}». Este producto no se puede vender.`);
      return;
    }
    const error = onAgregar(p);
    if (error) {
      setAdvertencia(error);
      return;
    }
    setAdvertencia("");
    setTexto("");
    inputRef.current?.focus();
  }

  return (
    <div>
      <label htmlFor={idCampo} className="mb-1.5 block text-lg font-bold">
        Buscar producto
      </label>
      <div className="relative">
        <Icono nombre="buscar" className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-texto-suave" />
        <input
          ref={inputRef}
          id={idCampo}
          type="search"
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAdvertencia("");
          }}
          onKeyDown={(e) => {
            // Enter agrega el primer resultado (rápido con lector de código de barras)
            if (e.key === "Enter") {
              e.preventDefault();
              if (resultados[0]) elegir(resultados[0]);
            }
          }}
          placeholder="Escribe el nombre o el código del producto"
          aria-describedby={`${idCampo}-ayuda`}
          className="block min-h-14 w-full rounded-xl border-2 border-marca-700 bg-white py-3 pl-12 pr-4 text-lg focus:outline-none focus:ring-4 focus:ring-marca-200"
        />
      </div>
      <p id={`${idCampo}-ayuda`} className="mt-1 text-base text-texto-suave">
        Escribe al menos 2 letras. Puedes escribir palabras sueltas, por ejemplo: «rosa 100».
      </p>

      {advertencia && (
        <div className="mt-3">
          <Mensaje tono="peligro" titulo="Atención">
            {advertencia}
          </Mensaje>
        </div>
      )}

      <div aria-live="polite" className="mt-3">
        {buscando && <p className="text-lg text-texto-suave">Buscando…</p>}
        {!buscando && buscado && resultados.length === 0 && (
          <p className="rounded-xl bg-gray-100 p-4 text-lg">No se encontró ningún producto con «{texto}».</p>
        )}
        {resultados.length > 0 && (
          <ul className="max-h-[26rem] space-y-2 overflow-y-auto rounded-xl border-2 border-gray-200 bg-gray-50 p-2" aria-label="Resultados de la búsqueda">
            {resultados.map((p) => {
              const sinStock = p.stock <= 0;
              const yaAgregado = enFactura[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => elegir(p)}
                    aria-disabled={sinStock}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border-2 bg-white px-4 py-3 text-left ${
                      sinStock ? "cursor-not-allowed border-peligro-700/40 opacity-80" : "border-gray-200 hover:border-marca-700 hover:bg-marca-50"
                    }`}
                  >
                    <span>
                      <span className="block text-lg font-bold">{p.nombre}</span>
                      <span className="text-base text-texto-suave">
                        {p.codigo ? `Código ${p.codigo} · ` : ""}
                        {pesos(p.precio)}
                        {yaAgregado > 0 ? ` · ya tienes ${yaAgregado} en la factura` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {sinStock ? (
                        <Insignia tono="peligro">Sin stock</Insignia>
                      ) : (
                        <Insignia tono={p.stock <= 3 ? "alerta" : "exito"}>Stock: {p.stock}</Insignia>
                      )}
                      {!sinStock && (
                        <span className="flex items-center gap-1 rounded-lg bg-marca-700 px-3 py-1.5 text-base font-bold text-white">
                          <Icono nombre="mas" className="size-5" />
                          Agregar
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
