/**
 * Detalle de un perfume: sus datos, sus últimos 20 movimientos (trazabilidad)
 * y las acciones menos frecuentes (editar, ajustar stock, eliminar).
 */
"use client";

import Link from "next/link";
import { Cargando, Dato, Insignia, Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import { ETIQUETA_TAMANO, ETIQUETA_TIPO, etiquetaPara, SIN_CATEGORIA } from "@/lib/clasificacion";
import { fechaHora, pesos } from "@/lib/formato";
import { ETIQUETA_MOVIMIENTO, type TipoMovimiento } from "@/lib/inventario";
import type { MovimientoInventario, Producto } from "@/tipos";
import { InsigniaStock, urlVender } from "./ListaProductos";

interface Props {
  producto: Producto;
  onCerrar: () => void;
  onAgregarUnidades: () => void;
  onEditar: () => void;
  onAjustar: () => void;
  onEliminar: () => void;
}

const TONO_MOVIMIENTO: Record<TipoMovimiento, "exito" | "info" | "alerta"> = {
  INGRESO: "exito",
  VENTA: "info",
  AJUSTE: "alerta",
};

/** "+5" o "−2" (con el signo menos tipográfico, más legible). */
const conSigno = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

export function DetalleProducto({ producto: p, onCerrar, onAgregarUnidades, onEditar, onAjustar, onEliminar }: Props) {
  const consulta = useConsulta<{ movimientos: MovimientoInventario[] }>(`/api/productos/${p.id}/movimientos`);
  const movimientos = consulta.datos?.movimientos ?? null;

  return (
    <Modal abierto onCerrar={onCerrar} titulo={p.nombre} tamano="lg">
      <div className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Marca">{p.marcaNombre ?? "Sin marca"}</Dato>
          <Dato etiqueta="Tipo">{p.tipo ? ETIQUETA_TIPO[p.tipo] : SIN_CATEGORIA}</Dato>
          <Dato etiqueta="Para">{p.genero && p.publico ? etiquetaPara(p.genero, p.publico) : SIN_CATEGORIA}</Dato>
          <Dato etiqueta="Tamaño">{p.tamano ? ETIQUETA_TAMANO[p.tamano] : SIN_CATEGORIA}</Dato>
          {p.codigo && <Dato etiqueta="Código">{p.codigo}</Dato>}
          <Dato etiqueta="Precio">
            <span className="text-2xl font-bold text-marca-800">{pesos(p.precio)}</span>
          </Dato>
          <Dato etiqueta="Stock">
            <span className="mr-2 text-2xl font-bold">{p.stock}</span>
            <InsigniaStock stock={p.stock} stockMinimo={p.stockMinimo} />
          </Dato>
          <Dato etiqueta="Aviso de stock bajo">Cuando queden {p.stockMinimo} o menos</Dato>
        </dl>

        <div className="grid gap-2 sm:grid-cols-2">
          <Boton icono="mas" onClick={onAgregarUnidades}>
            Agregar unidades
          </Boton>
          {p.stock > 0 ? (
            <Link
              href={urlVender(p)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-exito-700 bg-exito-700 px-5 text-lg font-bold text-white hover:bg-exito-800"
            >
              Vender
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-gray-300 bg-gray-100 px-5 text-lg font-bold text-gray-700">
              Agotado: no se puede vender
            </span>
          )}
          <Boton variante="secundario" icono="editar" onClick={onEditar}>
            Editar
          </Boton>
          <Boton variante="secundario" icono="inventario" onClick={onAjustar}>
            Ajustar stock
          </Boton>
          <Boton variante="peligro" icono="basura" onClick={onEliminar} className="sm:col-span-2">
            Eliminar producto
          </Boton>
        </div>

        <section aria-labelledby="titulo-movimientos">
          <h3 id="titulo-movimientos" className="text-xl font-bold">
            Últimos movimientos
          </h3>
          <p className="text-base text-texto-suave">Se muestran los 20 más recientes.</p>
          {consulta.error ? (
            <div className="mt-3">
              <Mensaje tono="peligro">{consulta.error}</Mensaje>
            </div>
          ) : !movimientos ? (
            <Cargando texto="Cargando movimientos…" />
          ) : movimientos.length === 0 ? (
            <p className="mt-3 rounded-xl bg-gray-50 p-4 text-lg">Este perfume aún no tiene movimientos registrados.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {movimientos.map((m) => (
                <li key={m.id} className="rounded-xl border-2 border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Insignia tono={TONO_MOVIMIENTO[m.tipo]}>{ETIQUETA_MOVIMIENTO[m.tipo]}</Insignia>
                      <span className="text-xl font-bold" aria-label={`${m.cantidad > 0 ? "Entraron" : "Salieron"} ${Math.abs(m.cantidad)} unidades`}>
                        {conSigno(m.cantidad)}
                      </span>
                      <span className="text-lg">→ quedaron {m.stockResultante}</span>
                    </span>
                    <span className="text-base text-texto-suave">{fechaHora(m.creadoEn)}</span>
                  </div>
                  <p className="mt-1 text-base text-texto-suave">
                    Por {m.usuarioNombre}
                    {m.facturaNumero !== null && ` · Factura #${m.facturaNumero}`}
                  </p>
                  {m.nota && m.tipo !== "VENTA" && <p className="mt-1 text-lg break-words">{m.nota}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
