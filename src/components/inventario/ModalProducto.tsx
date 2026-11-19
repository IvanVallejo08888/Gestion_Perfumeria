/**
 * Crear o editar un producto con todas sus características.
 * Orden de los campos: marca, fragancia, variante, concentración, ml, género (y público), categoría,
 * tipo, código, precio, stock y aviso de stock bajo.
 *  - Marca: se escribe con sugerencias de las marcas del local. Si no existe, se crea al guardar.
 *  - Vista previa en vivo del nombre completo, el mismo que irá en la factura.
 *  - Si ya existe un producto igual (marca + nombre + variante + concentración + ml),
 *    se advierte y se puede continuar con confirmación.
 *  - Al crear, las unidades iniciales quedan como INGRESO "Stock inicial".
 *  - Al editar, el stock NO se cambia aquí: se usa «Agregar unidades» o «Ajustar stock».
 */
"use client";

import { useId, useState, type FormEvent } from "react";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Confirmar, Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import {
  CATEGORIAS,
  CONCENTRACIONES,
  ETIQUETA_CATEGORIA,
  ETIQUETA_CONCENTRACION,
  ETIQUETA_GENERO,
  ETIQUETA_PUBLICO,
  ETIQUETA_TIPO,
  GENEROS,
  MILILITROS_SUGERIDOS,
  opcionesDe,
  PUBLICOS,
  TIPOS_PRODUCTO,
} from "@/lib/clasificacion";
import { api } from "@/lib/http";
import { armarNombreProducto } from "@/lib/productos";
import type { Categoria, Concentracion, Genero, NombreActivo, Producto, Publico, TipoProducto } from "@/tipos";

interface FormProducto {
  marca: string;
  nombre: string;
  variante: string;
  concentracion: Concentracion | null;
  /** Texto del campo (vacío = sin ml). */
  contenidoMl: string;
  genero: Genero | null;
  publico: Publico | null;
  categoria: Categoria | null;
  tipo: TipoProducto | null;
  codigo: string;
  precio: number;
  stock: number;
  stockMinimo: number;
}

const FORM_VACIO: FormProducto = {
  marca: "",
  nombre: "",
  variante: "",
  concentracion: null,
  contenidoMl: "",
  genero: null,
  publico: null,
  categoria: "PERFUME",
  tipo: null,
  codigo: "",
  precio: 0,
  stock: 0,
  stockMinimo: 3,
};

const desdeProducto = (p: Producto): FormProducto => ({
  marca: p.marcaNombre ?? "",
  nombre: p.fragancia,
  variante: p.variante ?? "",
  concentracion: p.concentracion,
  contenidoMl: p.contenidoMl ? String(p.contenidoMl) : "",
  genero: p.genero,
  publico: p.publico,
  categoria: p.categoria,
  tipo: p.tipo,
  codigo: p.codigo ?? "",
  precio: p.precio,
  stock: p.stock,
  stockMinimo: p.stockMinimo,
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
  const idMarcas = useId();
  const idMl = useId();

  const consultaMarcas = useConsulta<{ marcas: NombreActivo[] }>("/api/marcas");
  const marcas = consultaMarcas.datos?.marcas ?? [];

  const cambiar = <K extends keyof FormProducto>(campo: K, valor: FormProducto[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  // Vista previa: la MISMA función que usa el servidor al guardar
  const datos = aEnviar(form);
  const nombreCompleto = form.nombre.trim() ? armarNombreProducto(datos) : "";

  function validar(): string {
    if (!form.marca.trim()) return "Escribe la marca.";
    if (!form.nombre.trim()) return "Escribe el nombre de la fragancia.";
    if (form.contenidoMl && (!/^\d+$/.test(form.contenidoMl) || Number(form.contenidoMl) <= 0)) return "El contenido debe ser un número entero de mililitros.";
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

  return (
    <Modal abierto onCerrar={onCerrar} titulo={producto ? "Editar producto" : "Agregar producto"} tamano="lg">
      <form onSubmit={enviar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}

        {/* 1-3. Qué es */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Campo
              etiqueta="Marca"
              list={idMarcas}
              autoComplete="off"
              maxLength={80}
              value={form.marca}
              onChange={(e) => cambiar("marca", e.target.value)}
              ayuda="Elige una de la lista o escribe una nueva."
              placeholder="Ej. Creed, Dior, Carolina Herrera"
              obligatorio
              autoFocus
            />
            <datalist id={idMarcas}>
              {marcas.map((m) => (
                <option key={m.id} value={m.nombre} />
              ))}
            </datalist>
          </div>
          <Campo
            etiqueta="Nombre de la fragancia"
            maxLength={120}
            value={form.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            placeholder="Ej. Aventus, Sauvage, Good Girl"
            obligatorio
          />
        </div>
        <Campo
          etiqueta="Variante (opcional)"
          maxLength={60}
          value={form.variante}
          onChange={(e) => cambiar("variante", e.target.value)}
          placeholder="Ej. Intense, Blush, Tester, Edición limitada"
          ayuda="En un estuche, escribe lo que trae con «+»: «+ gel» (va al final del nombre)."
        />

        {/* 4-5. Cómo es */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Selector etiqueta="Concentración" value={form.concentracion ?? ""} onChange={(e) => cambiar("concentracion", (e.target.value || null) as Concentracion | null)}>
            <option value="">Sin especificar</option>
            {CONCENTRACIONES.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CONCENTRACION[c]}
              </option>
            ))}
          </Selector>
          <div>
            <Campo
              etiqueta="Contenido en ml"
              inputMode="numeric"
              list={idMl}
              autoComplete="off"
              value={form.contenidoMl}
              onChange={(e) => cambiar("contenidoMl", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Ej. 100"
              ayuda="Déjalo vacío si no se mide en ml (estuche, accesorio)."
            />
            <datalist id={idMl}>
              {MILILITROS_SUGERIDOS.map((ml) => (
                <option key={ml} value={ml} />
              ))}
            </datalist>
          </div>
        </div>

        {/* 6. Para quién */}
        <OpcionalBotones
          titulo="Género"
          opciones={opcionesDe(GENEROS, ETIQUETA_GENERO)}
          valor={form.genero}
          onCambio={(genero) => setForm((f) => ({ ...f, genero, publico: genero ? (f.publico ?? "ADULTO") : null }))}
        />
        {form.genero && (
          <BotonesMedioPago titulo="Público" opciones={opcionesDe(PUBLICOS, ETIQUETA_PUBLICO)} valor={form.publico} onCambio={(publico) => cambiar("publico", publico)} />
        )}

        {/* 7. Categoría y tipo */}
        <Selector etiqueta="Categoría" value={form.categoria ?? ""} onChange={(e) => cambiar("categoria", (e.target.value || null) as Categoria | null)}>
          <option value="">Sin especificar</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CATEGORIA[c]}
            </option>
          ))}
        </Selector>
        <OpcionalBotones titulo="Tipo" opciones={opcionesDe(TIPOS_PRODUCTO, ETIQUETA_TIPO)} valor={form.tipo} onCambio={(tipo) => cambiar("tipo", tipo)} />

        {/* Vista previa en vivo */}
        <div aria-live="polite" className="rounded-xl border-2 border-marca-700 bg-marca-50 p-4 text-lg">
          <p className="text-base font-bold text-texto-suave">Así se verá en la factura:</p>
          <p className="mt-1 text-xl font-bold break-words text-acento">{nombreCompleto || "Escribe la marca y el nombre de la fragancia"}</p>
        </div>

        {/* 8-11. Venta y stock */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Código (opcional)" value={form.codigo} onChange={(e) => cambiar("codigo", e.target.value)} ayuda="Por ejemplo, el código de barras." />
          <CampoDinero etiqueta="Precio de venta" valor={form.precio} onCambio={(v) => cambiar("precio", v)} obligatorio />
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
            ayuda="Recibirás una notificación de stock bajo."
          />
        </div>
        {consultaMarcas.error && <Mensaje tono="alerta">No se pudieron cargar las marcas sugeridas: {consultaMarcas.error}</Mensaje>}
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

/** Botones de opción para un dato OPCIONAL: muestra «Quitar» para dejarlo vacío. */
function OpcionalBotones<T extends string>({
  titulo,
  opciones,
  valor,
  onCambio,
}: {
  titulo: string;
  opciones: { valor: T; texto: string }[];
  valor: T | null;
  onCambio: (valor: T | null) => void;
}) {
  return (
    <div>
      <BotonesMedioPago titulo={`${titulo} (opcional)`} opciones={opciones} valor={valor} onCambio={onCambio} />
      {valor && (
        <Boton pequeno variante="fantasma" icono="cerrar" className="mt-2" onClick={() => onCambio(null)}>
          {`Quitar ${titulo.toLowerCase()}`}
        </Boton>
      )}
    </div>
  );
}
