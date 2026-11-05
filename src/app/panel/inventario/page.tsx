/**
 * Inventario de productos del local.
 * - Crear, editar y eliminar productos.
 * - "Entrada / salida" para sumar o restar unidades rápidamente.
 * - El stock se descuenta SOLO al vender (desde Facturación).
 */
"use client";

import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Confirmar, Modal } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import type { Producto } from "@/tipos";

const FORM_VACIO = { nombre: "", codigo: "", precio: 0, stock: 0, stockMinimo: 3 };

export default function PaginaInventario() {
  const avisos = useAvisos();
  const [texto, setTexto] = useState("");
  const textoBuscado = useValorDiferido(texto.trim(), 300);
  const consulta = useConsulta<{ productos: Producto[] }>(
    `/api/productos${textoBuscado ? `?q=${encodeURIComponent(textoBuscado)}` : ""}`,
    { alError: avisos.error },
  );
  const productos = consulta.datos?.productos ?? (consulta.error ? [] : null);
  const cargar = consulta.recargar;
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);
  const [ajustando, setAjustando] = useState<Producto | null>(null);
  const [eliminando, setEliminando] = useState<Producto | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState(false);

  async function eliminar() {
    if (!eliminando) return;
    setCargandoAccion(true);
    try {
      await api(`/api/productos/${eliminando.id}`, { method: "DELETE" });
      avisos.exito(`«${eliminando.nombre}» fue eliminado del inventario.`);
      setEliminando(null);
      cargar();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setCargandoAccion(false);
    }
  }

  const estadoStock = (p: Producto) =>
    p.stock === 0
      ? { tono: "peligro" as const, texto: "Agotado" }
      : p.stock <= p.stockMinimo
        ? { tono: "alerta" as const, texto: `Stock bajo: ${p.stock}` }
        : { tono: "exito" as const, texto: `Stock: ${p.stock}` };

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Productos de tu local. Al vender, el stock se descuenta solo."
        acciones={
          <Boton icono="mas" onClick={() => setEditando("nuevo")}>
            Agregar producto
          </Boton>
        }
      />

      <Tarjeta className="mb-6">
        <Campo type="search" etiqueta="Buscar en el inventario" placeholder="Nombre o código" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Tarjeta>

      {!productos ? (
        <Cargando />
      ) : productos.length === 0 ? (
        <Vacio icono="inventario" titulo={texto ? "No se encontraron productos" : "Tu inventario está vacío"}>
          {texto ? "Prueba con otra palabra." : "Presiona «Agregar producto» para empezar."}
        </Vacio>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productos.map((p) => {
            const estado = estadoStock(p);
            return (
              <li key={p.id}>
                <Tarjeta className="flex h-full flex-col">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{p.nombre}</h2>
                    {p.codigo && <p className="text-base text-texto-suave">Código: {p.codigo}</p>}
                    <p className="mt-2 text-2xl font-bold text-marca-800">{pesos(p.precio)}</p>
                    <div className="mt-2">
                      <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Boton pequeno icono="inventario" onClick={() => setAjustando(p)}>
                      Entrada / salida
                    </Boton>
                    <Boton pequeno variante="secundario" icono="editar" onClick={() => setEditando(p)}>
                      Editar
                    </Boton>
                    <Boton pequeno variante="peligro" icono="basura" onClick={() => setEliminando(p)}>
                      Eliminar
                    </Boton>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <ModalProducto
          producto={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
          onListo={(m) => {
            avisos.exito(m);
            setEditando(null);
            cargar();
            avisarCambioNotificaciones();
          }}
        />
      )}
      {ajustando && (
        <ModalAjuste
          producto={ajustando}
          onCerrar={() => setAjustando(null)}
          onListo={(m) => {
            avisos.exito(m);
            setAjustando(null);
            cargar();
            avisarCambioNotificaciones();
          }}
        />
      )}
      <Confirmar
        abierto={eliminando !== null}
        titulo="Eliminar producto"
        mensaje={
          <>
            ¿Seguro que deseas eliminar <strong>{eliminando?.nombre}</strong> del inventario? Las facturas anteriores no se afectan.
          </>
        }
        textoConfirmar="Sí, eliminar"
        peligro
        cargando={cargandoAccion}
        onConfirmar={eliminar}
        onCerrar={() => setEliminando(null)}
      />
    </>
  );
}

/* ---------------------------- Crear / editar ---------------------------- */

function ModalProducto({ producto, onCerrar, onListo }: { producto: Producto | null; onCerrar: () => void; onListo: (m: string) => void }) {
  const [form, setForm] = useState(
    producto
      ? { nombre: producto.nombre, codigo: producto.codigo ?? "", precio: producto.precio, stock: producto.stock, stockMinimo: producto.stockMinimo }
      : FORM_VACIO,
  );
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError("Escribe el nombre del producto.");
    if (form.precio <= 0) return setError("Escribe el precio de venta.");
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
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            etiqueta="Unidades en stock"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Math.max(0, Number(e.target.value) || 0) })}
            obligatorio
          />
          <Campo
            etiqueta="Avisar cuando queden"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: Math.max(0, Number(e.target.value) || 0) })}
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

/* ---------------------------- Entrada / salida ---------------------------- */

function ModalAjuste({ producto, onCerrar, onListo }: { producto: Producto; onCerrar: () => void; onListo: (m: string) => void }) {
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const resultado = tipo === "entrada" ? producto.stock + cantidad : producto.stock - cantidad;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (cantidad <= 0) return setError("Escribe una cantidad mayor que cero.");
    if (resultado < 0) return setError(`Solo hay ${producto.stock} unidades.`);
    setCargando(true);
    try {
      await api(`/api/productos/${producto.id}/stock`, { method: "POST", json: { cantidad: tipo === "entrada" ? cantidad : -cantidad } });
      onListo(`Stock de «${producto.nombre}» actualizado: ahora hay ${resultado}.`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Stock de ${producto.nombre}`}>
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <p className="text-lg">
          Unidades actuales: <strong>{producto.stock}</strong>
        </p>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-3">
          {(["entrada", "salida"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              className={`min-h-14 rounded-xl border-2 text-lg font-bold ${
                tipo === t ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-white"
              }`}
            >
              {t === "entrada" ? "➕ Entrada (llegó mercancía)" : "➖ Salida (daño, ajuste)"}
            </button>
          ))}
        </div>
        <Campo
          etiqueta="Cantidad de unidades"
          type="number"
          inputMode="numeric"
          min={1}
          value={cantidad}
          onChange={(e) => setCantidad(Math.max(0, Number(e.target.value) || 0))}
          obligatorio
        />
        <p className="text-lg" aria-live="polite">
          Quedarán <strong className={resultado < 0 ? "text-peligro-700" : ""}>{resultado}</strong> unidades.
        </p>
        <Boton type="submit" ancho cargando={cargando} icono="check">
          Guardar movimiento
        </Boton>
      </form>
    </Modal>
  );
}
