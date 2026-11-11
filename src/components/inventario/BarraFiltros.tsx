/**
 * Filtros del inventario (todos combinables; la página los guarda en la URL):
 *  - Pestañas Todos | Hombre | Mujer y, dentro de cada una, chips Adulto/Niño o Adulta/Niña.
 *  - Buscador por nombre o código.
 *  - Marca, tipo, tamaño y estado de stock: en celular y tablet van en un panel desplegable;
 *    en escritorio (≥1280px) se ven siempre, en una barra.
 * El botón elegido se marca con un ícono ✓ además del color.
 */
"use client";

import { useId, useState } from "react";
import { Tarjeta } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { ETIQUETA_TAMANO, ETIQUETA_TIPO, TAMANOS, TIPOS_PRODUCTO, type Genero, type Publico } from "@/lib/clasificacion";
import { contarFiltros, ESTADOS_STOCK, ETIQUETA_ESTADO_STOCK, type EstadoStock, type FiltrosInventario } from "@/lib/inventario";
import type { NombreActivo, Tamano, TipoProducto } from "@/tipos";

interface Props {
  filtros: FiltrosInventario;
  onCambiar: (filtros: FiltrosInventario) => void;
  /** Lo que la persona va escribiendo en el buscador (se aplica con un pequeño retraso). */
  texto: string;
  onTexto: (texto: string) => void;
  marcas: NombreActivo[] | null;
}

const PESTANAS: { valor: Genero | undefined; texto: string }[] = [
  { valor: undefined, texto: "Todos" },
  { valor: "HOMBRE", texto: "Hombre" },
  { valor: "MUJER", texto: "Mujer" },
];

const CHIPS: Record<Genero, { valor: Publico | undefined; texto: string }[]> = {
  HOMBRE: [
    { valor: undefined, texto: "Todos" },
    { valor: "ADULTO", texto: "Adulto" },
    { valor: "INFANTIL", texto: "Niño" },
  ],
  MUJER: [
    { valor: undefined, texto: "Todas" },
    { valor: "ADULTO", texto: "Adulta" },
    { valor: "INFANTIL", texto: "Niña" },
  ],
};

/** Botón de opción con aria-pressed: el estado se anuncia y se ve (✓ + color). */
function Opcion({ activa, onClick, children, grande = false }: { activa: boolean; onClick: () => void; children: string; grande?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border-2 px-2 font-bold sm:px-4 ${grande ? "text-lg sm:text-xl" : "text-lg"} ${
        activa ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-white text-texto hover:border-marca-700 hover:bg-marca-50"
      }`}
    >
      {activa && <Icono nombre="check" className="size-5 shrink-0" />}
      {children}
    </button>
  );
}

export function BarraFiltros({ filtros, onCambiar, texto, onTexto, marcas }: Props) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const panelId = useId();
  const activos = contarFiltros(filtros);
  const hayAlgo = activos > 0 || !!filtros.genero || !!texto;

  const cambiar = (cambios: Partial<FiltrosInventario>) => onCambiar({ ...filtros, ...cambios });

  return (
    <div className="mb-6 space-y-4">
      {/* Pestañas de género */}
      <div role="group" aria-label="Género" className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {PESTANAS.map((p) => (
          <Opcion
            key={p.texto}
            grande
            activa={filtros.genero === p.valor}
            // Al cambiar de pestaña se quita el chip anterior (Niño no aplica en Mujer)
            onClick={() => cambiar({ genero: p.valor, publico: undefined })}
          >
            {p.texto}
          </Opcion>
        ))}
      </div>

      {filtros.genero && (
        <div role="group" aria-label={`Público de ${filtros.genero === "HOMBRE" ? "hombre" : "mujer"}`} className="flex flex-wrap gap-2">
          {CHIPS[filtros.genero].map((c) => (
            <Opcion key={c.texto} activa={filtros.publico === c.valor} onClick={() => cambiar({ publico: c.valor })}>
              {c.texto}
            </Opcion>
          ))}
        </div>
      )}

      <Tarjeta>
        <div className="grid gap-4 xl:grid-cols-4 xl:items-end">
          <Campo
            type="search"
            etiqueta="Buscar en el inventario"
            placeholder="Nombre o código"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            className="xl:col-span-4"
          />

          <div className="xl:hidden">
            <Boton
              variante="secundario"
              ancho
              icono={panelAbierto ? "cerrar" : "flechaAbajo"}
              aria-expanded={panelAbierto}
              aria-controls={panelId}
              onClick={() => setPanelAbierto((a) => !a)}
            >
              {`${panelAbierto ? "Ocultar filtros" : "Más filtros"}${activos ? ` (${activos})` : ""}`}
            </Boton>
          </div>

          {/* En escritorio "contents" hace que los selectores ocupen las columnas de la barra */}
          <div id={panelId} className={`${panelAbierto ? "grid" : "hidden"} gap-4 sm:grid-cols-2 xl:contents`}>
            <Selector etiqueta="Marca" value={filtros.marcaId ?? ""} onChange={(e) => cambiar({ marcaId: e.target.value || undefined })}>
              <option value="">Todas las marcas</option>
              {marcas?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="Tipo" value={filtros.tipo ?? ""} onChange={(e) => cambiar({ tipo: (e.target.value || undefined) as TipoProducto | undefined })}>
              <option value="">Todos los tipos</option>
              {TIPOS_PRODUCTO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="Tamaño" value={filtros.tamano ?? ""} onChange={(e) => cambiar({ tamano: (e.target.value || undefined) as Tamano | undefined })}>
              <option value="">Todos los tamaños</option>
              {TAMANOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TAMANO[t]}
                </option>
              ))}
            </Selector>
            <Selector
              etiqueta="Estado de stock"
              value={filtros.stock ?? ""}
              onChange={(e) => cambiar({ stock: (e.target.value || undefined) as EstadoStock | undefined })}
            >
              <option value="">Todos</option>
              {ESTADOS_STOCK.map((s) => (
                <option key={s} value={s}>
                  {ETIQUETA_ESTADO_STOCK[s]}
                </option>
              ))}
            </Selector>
          </div>
        </div>

        {hayAlgo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-linea pt-4">
            <p className="text-lg text-texto-suave">{activos ? `${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}.` : "Mostrando una parte del inventario."}</p>
            <Boton variante="fantasma" icono="cerrar" onClick={() => onCambiar({})}>
              Quitar filtros
            </Boton>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
