/**
 * Lista de productos de la factura.
 * - La lista se ve SIEMPRE: un recuadro con scroll donde caben unos 3 productos.
 * - Al escribir se filtra desde la primera letra, sin importar mayúsculas, tildes, ñ ni signos.
 * - El inventario se carga una vez y se filtra en el navegador (es instantáneo). Si el local
 *   tiene más de 500 productos, se busca en el servidor con una pequeña espera (200 ms).
 * - Si no hay stock, la fila se ve atenuada, muestra una ADVERTENCIA y no se agrega a la venta.
 * - Si el producto ya está en la factura, suma una unidad (sin pasar del stock).
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { coincideBusqueda, normalizarTexto, pesos } from "@/lib/formato";
import type { ProductoVenta } from "@/tipos";
import { Cargando, Insignia, Mensaje } from "../ui/Basicos";
import { Icono } from "../ui/Icono";

interface Props {
  /** Devuelve un mensaje de error si no se pudo agregar (por ejemplo, stock insuficiente). */
  onAgregar: (producto: ProductoVenta) => string | null;
  /** Cantidades que ya están en la factura, por id de producto */
  enFactura: Record<string, number>;
  /** Cambia después de registrar una factura: indica que hay que recargar el inventario. */
  versionInventario: number;
}

export function BuscadorProductos({ onAgregar, enFactura, versionInventario }: Props) {
  const [texto, setTexto] = useState("");
  const [advertencia, setAdvertencia] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const idCampo = useId();

  const inventario = useConsulta<{ productos: ProductoVenta[]; hayMas: boolean }>("/api/productos");
  const { recargar } = inventario;
  useEffect(() => {
    if (versionInventario > 0) recargar();
  }, [versionInventario, recargar]);

  // Primero los productos con stock (dentro de cada grupo se conserva el orden por nombre)
  const productos = useMemo(
    () => [...(inventario.datos?.productos ?? [])].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)),
    [inventario.datos],
  );

  const consulta = texto.trim();
  // Solo signos (por ejemplo "-") no es una búsqueda: se sigue viendo toda la lista
  const hayBusqueda = normalizarTexto(consulta) !== "";

  /* Inventarios muy grandes: la búsqueda la hace el servidor */
  const enServidor = inventario.datos?.hayMas ?? false;
  const diferida = useValorDiferido(consulta, 200);
  const urlDe = (q: string) => `/api/productos/buscar?q=${encodeURIComponent(q)}`;
  const remota = useConsulta<{ productos: ProductoVenta[] }>(enServidor && diferida ? urlDe(diferida) : null);
  // Solo valen resultados de EXACTAMENTE lo escrito (así Enter nunca agrega algo de una búsqueda anterior)
  const remotaAlDia = remota.urlDatos === urlDe(consulta);

  const resultados = useMemo(() => {
    if (!hayBusqueda) return productos;
    if (enServidor) return remotaAlDia ? (remota.datos?.productos ?? []) : [];
    return productos.filter((p) => coincideBusqueda(p.nombre, p.codigo, consulta));
  }, [hayBusqueda, productos, enServidor, remotaAlDia, remota.datos, consulta]);

  const buscando = enServidor && hayBusqueda && !remota.error && !remotaAlDia;
  const errorCarga = inventario.error || (enServidor && hayBusqueda ? remota.error : "");

  function elegir(p: ProductoVenta, desdeTeclado = false) {
    if (p.stock <= 0) {
      setAdvertencia(`No hay stock de ${p.nombre}. No se puede vender.`);
      return;
    }
    const error = onAgregar(p);
    if (error) {
      setAdvertencia(error);
      return;
    }
    setAdvertencia("");
    // Con Enter (o lector de código de barras) se prepara la siguiente búsqueda.
    // Con el botón "+" se conserva el filtro y no se abre el teclado del celular.
    if (desdeTeclado) {
      setTexto("");
      inputRef.current?.focus();
    }
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
              if (hayBusqueda && resultados[0]) elegir(resultados[0], true);
            }
          }}
          placeholder="Buscar producto (ignora tildes y signos)…"
          className="block min-h-14 w-full rounded-xl border-2 border-marca-700 bg-white py-3 pl-12 pr-4 text-lg focus:outline-none focus:ring-4 focus:ring-marca-200"
        />
      </div>

      {/* En celular el texto de ayuda del campo no cabe completo: aquí se ve entero */}
      <p className="mt-1 text-base text-texto-suave sm:hidden">Ignora tildes y signos.</p>

      {advertencia && (
        <div className="mt-3">
          <Mensaje tono="peligro" titulo="Atención">
            {advertencia}
          </Mensaje>
        </div>
      )}

      <div aria-live="polite" className="mt-3">
        {errorCarga ? (
          <Mensaje tono="peligro">{errorCarga}</Mensaje>
        ) : !inventario.datos ? (
          <Cargando texto="Cargando productos…" />
        ) : buscando ? (
          <p className="rounded-xl bg-superficie-apagada p-4 text-lg">Buscando…</p>
        ) : resultados.length === 0 ? (
          <p className="rounded-xl bg-superficie-apagada p-4 text-lg">
            {hayBusqueda ? `No se encontró ningún producto con «${consulta}».` : "Este local aún no tiene productos en el inventario."}
          </p>
        ) : (
          <ul
            tabIndex={0}
            aria-label="Productos del inventario"
            className="max-h-[18rem] space-y-2 overflow-y-auto rounded-xl border-2 border-linea-fuerte bg-superficie p-1.5 sm:p-2"
          >
            {resultados.map((p) => {
              const sinStock = p.stock <= 0;
              const yaAgregado = enFactura[p.id] ?? 0;
              return (
                <li
                  key={p.id}
                  // Tocar una fila sin stock también avisa por qué no se puede vender.
                  // Las filas con stock solo agregan con el botón "+", para no agregar por error al deslizar.
                  onClick={sinStock ? () => elegir(p) : undefined}
                  className={`flex items-center justify-between gap-2 rounded-xl border-2 bg-white px-2 py-2 sm:px-3 ${
                    sinStock ? "cursor-not-allowed border-linea bg-superficie-apagada" : "border-linea"
                  }`}
                >
                  <div className={`min-w-0 flex-1 ${sinStock ? "opacity-70" : ""}`}>
                    <p className="text-lg font-bold leading-snug break-words">{p.nombre}</p>
                    {(p.codigo || yaAgregado > 0) && (
                      <p className="text-base leading-snug text-texto-suave">
                        {p.codigo ? `Código ${p.codigo}` : ""}
                        {p.codigo && yaAgregado > 0 ? " · " : ""}
                        {yaAgregado > 0 ? `En la factura: ${yaAgregado}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-lg font-bold whitespace-nowrap">{pesos(p.precio)}</span>
                    {sinStock ? (
                      <Insignia tono="peligro">Sin stock</Insignia>
                    ) : (
                      <Insignia tono={p.stock <= 3 ? "alerta" : "exito"}>Stock: {p.stock}</Insignia>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      elegir(p);
                    }}
                    aria-disabled={sinStock}
                    aria-label={`Agregar ${p.nombre}`}
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full border-2 sm:size-14 ${
                      sinStock
                        ? "cursor-not-allowed border-borde bg-linea text-texto-tenue"
                        : "border-marca-700 bg-marca-700 text-white hover:bg-marca-800"
                    }`}
                  >
                    <Icono nombre="mas" className="size-7" />
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
