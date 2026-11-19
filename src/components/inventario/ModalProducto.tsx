/**
 * Crear o editar un producto.
 * Orden del formulario: nombre del perfume → código → marca → variante → tipo, género, público,
 * categoría y tamaño → precio, unidades y aviso de stock bajo.
 *  - Marca: se elige de las del local o se agrega ahí mismo («Agregar marca»).
 *  - Tamaño en ml con su equivalente en oz; si no está en la lista, «Otro tamaño» deja escribir los ml.
 *  - Vista previa del nombre completo, el mismo que irá en la factura.
 *  - Si ya existe un producto igual (marca + nombre + variante + ml), se advierte y se puede continuar.
 *  - Al crear, las unidades iniciales quedan como INGRESO "Stock inicial".
 *  - Al editar, el stock NO se cambia aquí: se usa «Agregar unidades» o «Ajustar stock»
 *    para que cada cambio quede registrado.
 *  - La concentración ya no se pide; si un producto antiguo la tiene, se conserva al editarlo.
 */
"use client";

import { useState, type FormEvent } from "react";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Confirmar, Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import {
  CATEGORIAS_FORMULARIO,
  ETIQUETA_CATEGORIA,
  ETIQUETA_GENERO,
  ETIQUETA_PUBLICO,
  ETIQUETA_TIPO,
  GENEROS,
  GRUPOS_MILILITROS,
  opcionesDe,
  PUBLICOS,
  textoMlConOz,
  TIPOS_PRODUCTO,
} from "@/lib/clasificacion";
import { api } from "@/lib/http";
import { armarNombreProducto } from "@/lib/productos";
import type { Categoria, Concentracion, Genero, NombreActivo, Producto, Publico, TipoProducto } from "@/tipos";

/** Valor del selector de tamaño que muestra el campo para escribir los ml. */
const OTRO_TAMANO = "otro";
const TAMANOS_LISTA: number[] = GRUPOS_MILILITROS.flatMap((g) => g.mililitros);

interface FormProducto {
  nombre: string;
  codigo: string;
  marca: string;
  variante: string;
  tipo: TipoProducto | null;
  genero: Genero | null;
  publico: Publico | null;
  categoria: Categoria | null;
  /** Texto con los ml (vacío = sin tamaño, por ejemplo un estuche). */
  contenidoMl: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  /** No se pide en el formulario: solo se conserva la de los productos antiguos. */
  concentracion: Concentracion | null;
}

const FORM_VACIO: FormProducto = {
  nombre: "",
  codigo: "",
  marca: "",
  variante: "",
  tipo: null,
  genero: null,
  publico: null,
  categoria: "PERFUME",
  contenidoMl: "",
  precio: 0,
  stock: 0,
  // Por defecto avisa cuando se agota (0 unidades); se puede subir si se quiere el aviso antes
  stockMinimo: 0,
  concentracion: null,
};

const desdeProducto = (p: Producto): FormProducto => ({
  nombre: p.fragancia,
  codigo: p.codigo ?? "",
  marca: p.marcaNombre ?? "",
  variante: p.variante ?? "",
  tipo: p.tipo,
  genero: p.genero,
  publico: p.publico,
  categoria: p.categoria,
  contenidoMl: p.contenidoMl ? String(p.contenidoMl) : "",
  precio: p.precio,
  stock: p.stock,
  stockMinimo: p.stockMinimo,
  concentracion: p.concentracion,
});

/** Lo que se envía al servidor (el nombre completo lo arma el servidor, no el navegador). */
const aEnviar = (f: FormProducto) => ({
  ...f,
  variante: f.variante.trim() || null,
  contenidoMl: f.contenidoMl ? Number(f.contenidoMl) : null,
  publico: f.genero ? f.publico : null,
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
  /** Producto parecido encontrado: se pide confirmación antes de guardar. */
  const [duplicado, setDuplicado] = useState<string | null>(null);
  // "Otro tamaño" abierto: el producto tiene unos ml que no están en la lista, o la persona lo eligió
  const [otroTamano, setOtroTamano] = useState(() => form.contenidoMl !== "" && !TAMANOS_LISTA.includes(Number(form.contenidoMl)));

  const consultaMarcas = useConsulta<{ marcas: NombreActivo[] }>("/api/marcas");
  const marcas = consultaMarcas.datos?.marcas ?? null;
  // Si el producto tiene una marca que el administrador desactivó, se muestra igual para poder conservarla
  const marcaDesactivada = producto?.marcaNombre && marcas && !marcas.some((m) => m.nombre === producto.marcaNombre) ? producto.marcaNombre : null;
  const sinMarcas = marcas?.length === 0 && !marcaDesactivada;

  const cambiar = <K extends keyof FormProducto>(campo: K, valor: FormProducto[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  // Vista previa: la MISMA función que usa el servidor al guardar
  const datos = aEnviar(form);
  const nombreCompleto = form.nombre.trim() && form.marca ? armarNombreProducto(datos) : "";
  const ml = Number(form.contenidoMl);

  function validar(): string {
    if (!form.nombre.trim()) return "Escribe el nombre del perfume.";
    if (!form.marca.trim()) return "Elige la marca.";
    if (form.contenidoMl && (!/^\d+$/.test(form.contenidoMl) || ml <= 0)) return "El tamaño debe ser un número entero de mililitros.";
    if (form.precio <= 0) return "Escribe el precio de venta.";
    return "";
  }

  async function guardar(confirmado = false) {
    setCargando(true);
    setError("");
    try {
      // Advertencia de posible duplicado (solo si la persona aún no confirmó)
      if (!confirmado) {
        const { duplicado: igual } = await api<{ duplicado: { id: string; nombre: string } | null }>("/api/productos/duplicado", {
          method: "POST",
          json: { ...datos, excluirId: producto?.id },
        });
        if (igual) {
          setDuplicado(igual.nombre);
          setCargando(false);
          return;
        }
      }
      if (producto) await api(`/api/productos/${producto.id}`, { method: "PUT", json: datos });
      else await api("/api/productos", { method: "POST", json: datos });
      onListo(producto ? "Producto actualizado." : `«${nombreCompleto}» agregado al inventario.`);
    } catch (err) {
      setError((err as Error).message === "Ya existe un registro con esos datos." ? "Ya existe un producto con ese código." : (err as Error).message);
      setCargando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    void guardar();
  }

  function elegirTamano(valor: string) {
    if (valor === OTRO_TAMANO) {
      setOtroTamano(true);
      cambiar("contenidoMl", "");
      return;
    }
    setOtroTamano(false);
    cambiar("contenidoMl", valor);
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={producto ? "Editar producto" : "Agregar producto"}>
      <form onSubmit={enviar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}

        <Campo
          etiqueta="Nombre del perfume"
          maxLength={120}
          value={form.nombre}
          onChange={(e) => cambiar("nombre", e.target.value)}
          placeholder="Ej. Aventus, Sauvage, Good Girl"
          obligatorio
          autoFocus
        />
        <Campo etiqueta="Código (opcional)" value={form.codigo} onChange={(e) => cambiar("codigo", e.target.value)} ayuda="Por ejemplo, el código de barras." />

        <SelectorMarca
          marcas={marcas}
          marcaDesactivada={marcaDesactivada}
          sinMarcas={sinMarcas}
          valor={form.marca}
          onCambio={(marca) => cambiar("marca", marca)}
          onMarcaCreada={async (marca) => {
            await consultaMarcas.recargar();
            cambiar("marca", marca);
          }}
        />
        {consultaMarcas.error && <Mensaje tono="peligro">{consultaMarcas.error}</Mensaje>}

        <Campo
          etiqueta="Variante (opcional)"
          maxLength={60}
          value={form.variante}
          onChange={(e) => cambiar("variante", e.target.value)}
          placeholder="Ej. Intense, Blush, Tester"
          ayuda="En un estuche, escribe lo que trae con «+»: «+ gel» (va al final del nombre)."
        />

        <BotonesMedioPago titulo="Tipo" opciones={opcionesDe(TIPOS_PRODUCTO, ETIQUETA_TIPO)} valor={form.tipo} onCambio={(tipo) => cambiar("tipo", tipo)} />
        <BotonesMedioPago
          titulo="Género"
          opciones={opcionesDe(GENEROS, ETIQUETA_GENERO)}
          valor={form.genero}
          onCambio={(genero) => setForm((f) => ({ ...f, genero, publico: f.publico ?? "ADULTO" }))}
        />
        {form.genero && (
          <BotonesMedioPago titulo="Público" opciones={opcionesDe(PUBLICOS, ETIQUETA_PUBLICO)} valor={form.publico} onCambio={(publico) => cambiar("publico", publico)} />
        )}

        <Selector etiqueta="Categoría" value={form.categoria ?? ""} onChange={(e) => cambiar("categoria", (e.target.value || null) as Categoria | null)}>
          <option value="">Sin especificar</option>
          {CATEGORIAS_FORMULARIO.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CATEGORIA[c]}
            </option>
          ))}
          {/* Un producto antiguo con una categoría que ya no se ofrece la conserva */}
          {form.categoria && !(CATEGORIAS_FORMULARIO as readonly string[]).includes(form.categoria) && (
            <option value={form.categoria}>{ETIQUETA_CATEGORIA[form.categoria]}</option>
          )}
        </Selector>

        <Selector
          etiqueta="Tamaño"
          value={otroTamano ? OTRO_TAMANO : form.contenidoMl}
          onChange={(e) => elegirTamano(e.target.value)}
          ayuda="En ml, con su equivalente en onzas."
        >
          <option value="">Sin tamaño (estuche u otro)</option>
          {GRUPOS_MILILITROS.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.mililitros.map((m) => (
                <option key={m} value={String(m)}>
                  {textoMlConOz(m)}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={OTRO_TAMANO}>Otro tamaño…</option>
        </Selector>
        {otroTamano && (
          <Campo
            etiqueta="Tamaño en ml"
            inputMode="numeric"
            autoComplete="off"
            value={form.contenidoMl}
            onChange={(e) => cambiar("contenidoMl", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Ej. 35"
            ayuda={ml > 0 ? `Equivale a ${textoMlConOz(ml)}.` : "Escribe los mililitros: se mostrará su equivalente en onzas."}
            obligatorio
          />
        )}

        <CampoDinero etiqueta="Precio de venta" valor={form.precio} onCambio={(v) => cambiar("precio", v)} obligatorio />

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
              onChange={(e) => cambiar("stock", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
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
            onChange={(e) => cambiar("stockMinimo", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            ayuda="Recibirás una notificación de stock bajo. Con 0, cuando se agote."
          />
        </div>

        {/* Vista previa en vivo */}
        <div aria-live="polite" className="rounded-xl border-2 border-marca-700 bg-marca-50 p-4 text-lg">
          <p className="text-base font-bold text-texto-suave">Así se verá en la factura:</p>
          <p className="mt-1 text-xl font-bold break-words text-acento">{nombreCompleto || "Escribe el nombre del perfume y elige la marca"}</p>
        </div>

        <Boton type="submit" ancho cargando={cargando} icono="check">
          Guardar
        </Boton>
      </form>

      <Confirmar
        abierto={duplicado !== null}
        titulo="¿Producto repetido?"
        mensaje={
          <div className="space-y-2">
            <p>Ya existe en tu inventario:</p>
            <p className="rounded-xl bg-superficie p-3 font-bold break-words">{duplicado}</p>
            <p>¿Es otro producto (por ejemplo, un tester o un lote distinto) y quieres guardarlo de todos modos?</p>
          </div>
        }
        textoConfirmar="Sí, guardar de todos modos"
        cargando={cargando}
        onConfirmar={() => {
          setDuplicado(null);
          void guardar(true);
        }}
        onCerrar={() => setDuplicado(null)}
      />
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
  marcaDesactivada: string | null;
  sinMarcas: boolean;
  /** Nombre de la marca elegida. */
  valor: string;
  onCambio: (marca: string) => void;
  onMarcaCreada: (marca: string) => Promise<void>;
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
      await onMarcaCreada(marca.nombre);
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
            {marcaDesactivada && <option value={marcaDesactivada}>{`${marcaDesactivada} (desactivada)`}</option>}
            {marcas?.map((m) => (
              <option key={m.id} value={m.nombre}>
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
