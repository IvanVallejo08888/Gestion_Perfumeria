/**
 * Lista del inventario en dos formatos (mismos datos, mismas acciones):
 *  - Celular y tablet: tarjetas apiladas con los 2 botones grandes a lo ancho.
 *  - Escritorio (≥1280px): tabla Marca | Fragancia | Características | Género | Tipo | Precio | Stock | Acciones.
 *  - La marca va en grande; las características (EDP · 100 ml · categoría) como insignias.
 * "Vender" es un enlace a Facturación con el perfume ya cargado (?producto=id).
 */
"use client";

import Link from "next/link";
import { Insignia } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { ETIQUETA_CATEGORIA, ETIQUETA_GENERO, ETIQUETA_TIPO, etiquetaPara, SIGLA_CONCENTRACION, SIN_CATEGORIA, textoMl } from "@/lib/clasificacion";
import { pesos } from "@/lib/formato";
import { estadoStock } from "@/lib/inventario";
import type { Producto } from "@/tipos";

interface Props {
  productos: Producto[];
  onAgregarUnidades: (p: Producto) => void;
  onDetalle: (p: Producto) => void;
}

export const urlVender = (p: Pick<Producto, "id">) => `/panel/facturacion?producto=${p.id}`;

/** Estado del stock: siempre con texto (el color solo refuerza). */
export function InsigniaStock({ stock, stockMinimo }: Pick<Producto, "stock" | "stockMinimo">) {
  const estado = estadoStock(stock, stockMinimo);
  if (estado === "AGOTADO") return <Insignia tono="peligro">Agotado</Insignia>;
  if (estado === "BAJO") return <Insignia tono="alerta">Stock bajo</Insignia>;
  return <Insignia tono="exito">Disponible</Insignia>;
}

/** Versión corta para la tabla: el número ya se ve arriba. "Disponible" va sin recuadro para ahorrar espacio. */
function EstadoCorto({ stock, stockMinimo }: Pick<Producto, "stock" | "stockMinimo">) {
  const estado = estadoStock(stock, stockMinimo);
  if (estado === "AGOTADO") return <Insignia tono="peligro">Agotado</Insignia>;
  if (estado === "BAJO") return <Insignia tono="alerta">Bajo</Insignia>;
  return <span className="text-sm text-exito-800">Disponible</span>;
}

const publicoDe = (p: Producto) => (p.genero ? (p.publico ? etiquetaPara(p.genero, p.publico) : ETIQUETA_GENERO[p.genero]) : null);

/** "EDP · 100 ml" (lo que no se llenó no aparece). */
export function caracteristicasDe(p: Pick<Producto, "concentracion" | "contenidoMl">): string {
  return [p.concentracion && p.concentracion !== "OTRO" ? SIGLA_CONCENTRACION[p.concentracion] : "", p.contenidoMl ? textoMl(p.contenidoMl) : ""]
    .filter(Boolean)
    .join(" · ");
}

/** Fragancia con su variante: "Good Girl Blush". */
const fraganciaDe = (p: Producto) => [p.fragancia, p.variante].filter(Boolean).join(" ");

/** Sin ninguna característica (productos anteriores a la clasificación). */
const sinDatos = (p: Producto) => !p.tipo && !p.genero && !p.concentracion && !p.contenidoMl && !p.categoria;

/** Botón grande "Vender" (enlace). Si está agotado, se muestra deshabilitado y con el motivo. */
function BotonVender({ producto, compacto = false }: { producto: Producto; compacto?: boolean }) {
  const base = `inline-flex items-center justify-center gap-2 rounded-xl border-2 font-bold ${compacto ? "min-h-11 px-2 text-[14px]" : "min-h-12 w-full px-5 text-lg"}`;
  if (producto.stock <= 0) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed border-linea-fuerte bg-superficie-apagada text-texto-suave`}>
        {!compacto && <Icono nombre="factura" className="size-5" />}
        Agotado
      </span>
    );
  }
  return (
    <Link
      href={urlVender(producto)}
      aria-label={`Vender ${producto.nombre}`}
      className={`${base} border-exito-700 bg-exito-700 text-white hover:bg-exito-800`}
    >
      {!compacto && <Icono nombre="factura" className="size-5" />}
      Vender
    </Link>
  );
}

export function ListaProductos({ productos, onAgregarUnidades, onDetalle }: Props) {
  return (
    <>
      {/* ---------- Celular y tablet: tarjetas ---------- */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:hidden">
        {productos.map((p) => {
          const publico = publicoDe(p);
          const caracteristicas = caracteristicasDe(p);
          return (
            <li key={p.id} className="flex flex-col rounded-2xl border-2 border-linea bg-tarjeta p-4 shadow-sm">
              {/* Marca en grande; el nombre completo queda para lectores de pantalla */}
              <p className="text-2xl font-bold break-words text-acento">{p.marcaNombre ?? "Sin marca"}</p>
              <h2 className="text-xl font-bold break-words">
                {fraganciaDe(p)}
                <span className="sr-only"> ({p.nombre})</span>
              </h2>
              {p.codigo && <p className="text-base text-texto-suave">Código: {p.codigo}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {sinDatos(p) ? (
                  <Insignia tono="alerta">{SIN_CATEGORIA}</Insignia>
                ) : (
                  <>
                    {caracteristicas && <Insignia tono="marca">{caracteristicas}</Insignia>}
                    {publico && <Insignia tono="info">{publico}</Insignia>}
                    {p.categoria && p.categoria !== "PERFUME" && <Insignia>{ETIQUETA_CATEGORIA[p.categoria]}</Insignia>}
                    {p.tipo && <Insignia>{ETIQUETA_TIPO[p.tipo]}</Insignia>}
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-1 flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="text-base text-texto-suave">Precio</p>
                  <p className="text-3xl font-bold text-acento">{pesos(p.precio)}</p>
                </div>
                <div className="text-right">
                  <p className="text-base text-texto-suave">Stock</p>
                  <p className="text-3xl font-bold">{p.stock}</p>
                </div>
              </div>
              <div className="mt-2">
                <InsigniaStock stock={p.stock} stockMinimo={p.stockMinimo} />
              </div>
              <div className="mt-4 grid gap-2">
                <Boton ancho icono="mas" onClick={() => onAgregarUnidades(p)} aria-label={`Agregar unidades a ${p.nombre}`}>
                  Agregar unidades
                </Boton>
                <BotonVender producto={p} />
                <Boton ancho variante="fantasma" icono="ojo" onClick={() => onDetalle(p)} aria-label={`Ver detalle de ${p.nombre}`}>
                  Ver detalle
                </Boton>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---------- Escritorio: tabla ---------- */}
      {/*
       * Tabla: letra de 15px en peso normal; la negrita queda solo para encabezados y botones.
       * Encabezados y celdas centrados (cada columna se alinea igual que su encabezado).
       * Con letra A++ la tabla se desplaza por dentro.
       */}
      <div className="hidden overflow-x-auto rounded-2xl border-2 border-linea bg-tarjeta shadow-sm xl:block">
        <table className="w-full text-center text-[15px]">
          <caption className="sr-only">Perfumes del inventario</caption>
          <thead className="bg-superficie">
            <tr className="border-b-2 border-linea-fuerte">
              <th scope="col" className="px-2 py-3 font-bold">Marca</th>
              <th scope="col" className="px-2 py-3 font-bold">Fragancia</th>
              <th scope="col" className="px-2 py-3 font-bold">Características</th>
              <th scope="col" className="px-2 py-3 font-bold">Género</th>
              <th scope="col" className="px-2 py-3 font-bold">Tipo</th>
              <th scope="col" className="px-2 py-3 font-bold">Precio</th>
              <th scope="col" className="px-2 py-3 font-bold">Stock</th>
              <th scope="col" className="px-2 py-3 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const publico = publicoDe(p);
              const caracteristicas = caracteristicasDe(p);
              return (
                <tr key={p.id} className="border-b border-linea align-top last:border-b-0">
                  <td className="px-2 py-3 font-bold">{p.marcaNombre ?? <span className="font-normal text-texto-suave">—</span>}</td>
                  <th scope="row" className="px-2 py-3 font-normal">
                    {fraganciaDe(p)}
                    <span className="sr-only"> ({p.nombre})</span>
                    {p.codigo && <span className="block text-sm text-texto-suave">{p.codigo}</span>}
                    {sinDatos(p) && (
                      <span className="mt-1 block">
                        <Insignia tono="alerta">{SIN_CATEGORIA}</Insignia>
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-3">
                    {caracteristicas || "—"}
                    {p.categoria && p.categoria !== "PERFUME" && <span className="block text-sm text-texto-suave">{ETIQUETA_CATEGORIA[p.categoria]}</span>}
                  </td>
                  <td className="px-2 py-3">{publico ?? "—"}</td>
                  <td className="px-2 py-3">{p.tipo ? ETIQUETA_TIPO[p.tipo] : "—"}</td>
                  <td className="px-2 py-3 whitespace-nowrap">{pesos(p.precio)}</td>
                  <td className="px-2 py-3">
                    <span className="block text-lg">{p.stock}</span>
                    <EstadoCorto stock={p.stock} stockMinimo={p.stockMinimo} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="mx-auto flex w-28 flex-col gap-1.5">
                      <Boton pequeno className="px-2! text-[14px]!" onClick={() => onAgregarUnidades(p)} aria-label={`Agregar unidades a ${p.nombre}`}>
                        + Unidades
                      </Boton>
                      <BotonVender producto={p} compacto />
                      <Boton variante="secundario" pequeno className="px-2! text-[14px]!" onClick={() => onDetalle(p)} aria-label={`Ver detalle de ${p.nombre}`}>
                        Detalle
                      </Boton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
