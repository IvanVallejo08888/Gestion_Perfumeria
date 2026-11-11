/**
 * Lista del inventario en dos formatos (mismos datos, mismas acciones):
 *  - Celular y tablet: tarjetas apiladas con los 2 botones grandes a lo ancho.
 *  - Escritorio (≥1280px): tabla Marca | Nombre | Tipo | Género | Tamaño | Precio | Stock | Acciones.
 * "Vender" es un enlace a Facturación con el perfume ya cargado (?producto=id).
 */
"use client";

import Link from "next/link";
import { Insignia } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { ETIQUETA_TAMANO, ETIQUETA_TIPO, etiquetaPara, SIN_CATEGORIA } from "@/lib/clasificacion";
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
  return <span className="text-[15px] text-exito-800">Disponible</span>;
}

const publicoDe = (p: Producto) => (p.genero && p.publico ? etiquetaPara(p.genero, p.publico) : null);

/** Botón grande "Vender" (enlace). Si está agotado, se muestra deshabilitado y con el motivo. */
function BotonVender({ producto, compacto = false }: { producto: Producto; compacto?: boolean }) {
  const base = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 font-bold ${compacto ? "px-2 text-[16px]" : "w-full px-5 text-lg"}`;
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
          const sinCategoria = !p.tipo && !p.tamano && !publico;
          return (
            <li key={p.id} className="flex flex-col rounded-2xl border-2 border-linea bg-white p-4 shadow-sm">
              <p className="text-base font-bold tracking-wide text-texto-suave uppercase">{p.marcaNombre ?? "Sin marca"}</p>
              <h2 className="text-xl font-bold break-words">{p.nombre}</h2>
              {p.codigo && <p className="text-base text-texto-suave">Código: {p.codigo}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {sinCategoria ? (
                  <Insignia tono="alerta">{SIN_CATEGORIA}</Insignia>
                ) : (
                  <>
                    {p.tipo && <Insignia tono="marca">{ETIQUETA_TIPO[p.tipo]}</Insignia>}
                    {p.tamano && <Insignia>{ETIQUETA_TAMANO[p.tamano]}</Insignia>}
                    {publico && <Insignia tono="info">{publico}</Insignia>}
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-1 flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="text-base text-texto-suave">Precio</p>
                  <p className="text-3xl font-bold text-marca-800">{pesos(p.precio)}</p>
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
      {/* Letra de 16px en la tabla para que quepan las 8 columnas; con letra A++ la tabla se desplaza por dentro */}
      <div className="hidden overflow-x-auto rounded-2xl border-2 border-linea bg-white shadow-sm xl:block">
        <table className="w-full text-left text-[16px]">
          <caption className="sr-only">Perfumes del inventario</caption>
          <thead className="bg-superficie">
            <tr className="border-b-2 border-linea-fuerte">
              <th scope="col" className="px-2 py-3">Marca</th>
              <th scope="col" className="px-2 py-3">Nombre</th>
              <th scope="col" className="px-2 py-3">Tipo</th>
              <th scope="col" className="px-2 py-3">Género</th>
              <th scope="col" className="px-2 py-3">Tamaño</th>
              <th scope="col" className="px-2 py-3 text-right">Precio</th>
              <th scope="col" className="px-2 py-3">Stock</th>
              <th scope="col" className="px-2 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const publico = publicoDe(p);
              const [oz, ml] = p.tamano ? ETIQUETA_TAMANO[p.tamano].split(" (") : [];
              return (
                <tr key={p.id} className="border-b border-linea align-top last:border-b-0">
                  <td className="px-2 py-3">{p.marcaNombre ?? <span className="text-texto-suave">—</span>}</td>
                  <th scope="row" className="px-2 py-3 font-bold">
                    {p.nombre}
                    {p.codigo && <span className="block text-[15px] font-normal text-texto-suave">{p.codigo}</span>}
                    {!p.tipo && !p.tamano && !publico && (
                      <span className="mt-1 block">
                        <Insignia tono="alerta">{SIN_CATEGORIA}</Insignia>
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-3">{p.tipo ? ETIQUETA_TIPO[p.tipo] : "—"}</td>
                  <td className="px-2 py-3">{publico ?? "—"}</td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    {oz ? (
                      <>
                        {oz}
                        <span className="block text-[15px] text-texto-suave">({ml}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-3 text-right font-bold whitespace-nowrap">{pesos(p.precio)}</td>
                  <td className="px-2 py-3">
                    <span className="block text-xl font-bold">{p.stock}</span>
                    <EstadoCorto stock={p.stock} stockMinimo={p.stockMinimo} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex w-32 flex-col gap-2">
                      <Boton className="px-2! text-[16px]!" onClick={() => onAgregarUnidades(p)} aria-label={`Agregar unidades a ${p.nombre}`}>
                        + Unidades
                      </Boton>
                      <BotonVender producto={p} compacto />
                      <Boton variante="secundario" className="px-2! text-[16px]!" onClick={() => onDetalle(p)} aria-label={`Ver detalle de ${p.nombre}`}>
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
