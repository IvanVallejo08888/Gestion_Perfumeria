/**
 * Crear o editar un perfume con su clasificación (marca, tipo, género, público y tamaño).
 *  - "Agregar marca" ahí mismo: la marca nueva queda elegida.
 *  - Al crear, las unidades iniciales quedan como INGRESO "Stock inicial".
 *  - Al editar, el stock NO se cambia aquí: se usa «Agregar unidades» o «Ajustar stock»
 *    para que cada cambio quede registrado.
 */
"use client";

import { useState, type FormEvent } from "react";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import { ETIQUETA_GENERO, ETIQUETA_PUBLICO, ETIQUETA_TAMANO, ETIQUETA_TIPO, GENEROS, opcionesDe, PUBLICOS, TAMANOS, TIPOS_PRODUCTO } from "@/lib/clasificacion";
import { api } from "@/lib/http";
import type { Genero, NombreActivo, Producto, Publico, Tamano, TipoProducto } from "@/tipos";

interface FormProducto {
  nombre: string;
  codigo: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  marcaId: string;
  tipo: TipoProducto | null;
  genero: Genero | null;
  publico: Publico | null;
  tamano: Tamano | null;
}

const FORM_VACIO: FormProducto = {
  nombre: "",
  codigo: "",
  precio: 0,
  stock: 0,
  stockMinimo: 3,
  marcaId: "",
  tipo: null,
  genero: null,
  publico: null,
  tamano: null,
};

const desdeProducto = (p: Producto): FormProducto => ({
  nombre: p.nombre,
  codigo: p.codigo ?? "",
  precio: p.precio,
  stock: p.stock,
  stockMinimo: p.stockMinimo,
  marcaId: p.marcaId ?? "",
  tipo: p.tipo,
  genero: p.genero,
  publico: p.publico,
  tamano: p.tamano,
});

interface Props {
  producto: Producto | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}

export function ModalProducto({ producto, onCerrar, onListo }: Props) {
  const [form, setForm] = useState<FormProducto>(producto ? desdeProducto(producto) : FORM_VACIO);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const consultaMarcas = useConsulta<{ marcas: NombreActivo[] }>("/api/marcas");
  const marcas = consultaMarcas.datos?.marcas ?? null;
  // Si el producto tiene una marca que el administrador desactivó, se muestra igual para poder conservarla
  const marcaDesactivada =
    producto?.marcaId && marcas && !marcas.some((m) => m.id === producto.marcaId)
      ? { id: producto.marcaId, nombre: `${producto.marcaNombre ?? "Marca"} (desactivada)` }
      : null;
  const sinMarcas = marcas?.length === 0 && !marcaDesactivada;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError("Escribe el nombre del producto.");
    if (form.precio <= 0) return setError("Escribe el precio de venta.");
    if (!form.marcaId) return setError("Elige la marca.");
    if (!form.tipo) return setError("Elige el tipo (Original, 1.1, Imitación, Versión o Esencia).");
    if (!form.genero) return setError("Elige si es para hombre o para mujer.");
    if (!form.publico) return setError("Elige si es para adulto o infantil.");
    if (!form.tamano) return setError("Elige el tamaño.");
    setCargando(true);
    setError("");
    try {
      if (producto) await api(`/api/productos/${producto.id}`, { method: "PUT", json: form });
      else await api("/api/productos", { method: "POST", json: form });
      onListo(producto ? "Producto actualizado." : `«${form.nombre}» agregado al inventario.`);
    } catch (err) {
      setError((err as Error).message === "Ya existe un registro con esos datos." ? "Ya existe un producto con ese código." : (err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={producto ? "Editar producto" : "Agregar producto"}>
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <Campo etiqueta="Nombre del producto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} obligatorio autoFocus />
        <Campo etiqueta="Código (opcional)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} ayuda="Por ejemplo, el código de barras." />
        <CampoDinero etiqueta="Precio de venta" valor={form.precio} onCambio={(v) => setForm({ ...form, precio: v })} obligatorio />

        <SelectorMarca
          marcas={marcas}
          marcaDesactivada={marcaDesactivada}
          sinMarcas={sinMarcas}
          valor={form.marcaId}
          onCambio={(marcaId) => setForm((f) => ({ ...f, marcaId }))}
          onMarcaCreada={async (marcaId) => {
            await consultaMarcas.recargar();
            setForm((f) => ({ ...f, marcaId }));
          }}
        />
        {consultaMarcas.error && <Mensaje tono="peligro">{consultaMarcas.error}</Mensaje>}

        <BotonesMedioPago titulo="Tipo" opciones={opcionesDe(TIPOS_PRODUCTO, ETIQUETA_TIPO)} valor={form.tipo} onCambio={(tipo) => setForm({ ...form, tipo })} />
        <BotonesMedioPago titulo="Género" opciones={opcionesDe(GENEROS, ETIQUETA_GENERO)} valor={form.genero} onCambio={(genero) => setForm({ ...form, genero })} />
        <BotonesMedioPago titulo="Público" opciones={opcionesDe(PUBLICOS, ETIQUETA_PUBLICO)} valor={form.publico} onCambio={(publico) => setForm({ ...form, publico })} />
        <Selector
          etiqueta="Tamaño"
          value={form.tamano ?? ""}
          onChange={(e) => setForm({ ...form, tamano: (e.target.value || null) as Tamano | null })}
          obligatorio
        >
          <option value="">Elige el tamaño</option>
          {TAMANOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TAMANO[t]}
            </option>
          ))}
        </Selector>

        <div className="grid gap-5 sm:grid-cols-2">
          {producto ? (
            <div>
              <p className="mb-1.5 text-lg font-bold">Unidades en stock</p>
              <p className="flex min-h-14 items-center rounded-xl border-2 border-linea bg-superficie px-4 text-2xl font-bold">{producto.stock}</p>
              <p className="mt-1.5 text-base text-texto-suave">Para cambiarlas usa «Agregar unidades» o «Ajustar stock».</p>
            </div>
          ) : (
            <Campo
              etiqueta="Unidades iniciales"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              ayuda="Quedan registradas como «Stock inicial»."
              obligatorio
            />
          )}
          <Campo
            etiqueta="Avisar cuando queden"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            ayuda="Recibirás una notificación de stock bajo."
          />
        </div>
        <Boton type="submit" ancho cargando={cargando} icono="check">
          Guardar
        </Boton>
      </form>
    </Modal>
  );
}

/* ----------------------- Marca: elegir o agregar nueva ----------------------- */

function SelectorMarca({
  marcas,
  marcaDesactivada,
  sinMarcas,
  valor,
  onCambio,
  onMarcaCreada,
}: {
  marcas: NombreActivo[] | null;
  marcaDesactivada: { id: string; nombre: string } | null;
  sinMarcas: boolean;
  valor: string;
  onCambio: (marcaId: string) => void;
  onMarcaCreada: (marcaId: string) => Promise<void>;
}) {
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const mostrarCampo = agregando || sinMarcas;

  async function crear() {
    if (!nombre.trim()) return setError("Escribe el nombre de la marca.");
    setGuardando(true);
    setError("");
    try {
      // Es un botón (no un submit): este bloque está dentro del formulario del producto
      const { marca } = await api<{ marca: { id: string; nombre: string; existia: boolean } }>("/api/marcas", {
        method: "POST",
        json: { nombre },
      });
      await onMarcaCreada(marca.id);
      setAviso(marca.existia ? `«${marca.nombre}» ya existía: quedó elegida.` : `Marca «${marca.nombre}» agregada y elegida.`);
      setNombre("");
      setAgregando(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!sinMarcas && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Selector etiqueta="Marca" value={valor} onChange={(e) => onCambio(e.target.value)} disabled={!marcas} obligatorio>
            <option value="">{marcas ? "Elige la marca" : "Cargando marcas…"}</option>
            {marcaDesactivada && <option value={marcaDesactivada.id}>{marcaDesactivada.nombre}</option>}
            {marcas?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Selector>
          {!agregando && (
            <Boton variante="secundario" icono="mas" onClick={() => (setAgregando(true), setAviso(""))}>
              Agregar marca
            </Boton>
          )}
        </div>
      )}
      {aviso && <Mensaje tono="exito">{aviso}</Mensaje>}

      {mostrarCampo && (
        <div className="space-y-3 rounded-xl border-2 border-marca-700 bg-marca-50 p-4">
          {sinMarcas && <p className="text-lg font-bold">Tu local aún no tiene marcas. Agrega la primera:</p>}
          <Campo
            etiqueta="Nombre de la marca nueva"
            value={nombre}
            maxLength={80}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              // Enter guarda la marca, no el producto
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              }
            }}
            error={error || undefined}
            obligatorio
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Boton icono="check" cargando={guardando} onClick={crear}>
              Guardar marca
            </Boton>
            {!sinMarcas && (
              <Boton variante="fantasma" onClick={() => (setAgregando(false), setNombre(""), setError(""))}>
                Cancelar
              </Boton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
