/**
 * Gestión de locales (solo administrador): crear, editar y activar/desactivar.
 * Desde cada local también se administran sus sectores de la ciudad y sus categorías de gastos.
 */
"use client";

import { useState, type FormEvent } from "react";
import { GestorNombres } from "@/components/compartidos/GestorNombres";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Modal } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { api } from "@/lib/http";

interface Local {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  totalUsuarios: number;
  totalProductos: number;
}

const FORM_VACIO = { nombre: "", direccion: "", telefono: "", activo: true };

export default function PaginaLocales() {
  const avisos = useAvisos();
  const consulta = useConsulta<{ locales: Local[] }>("/api/admin/locales", { alError: avisos.error });
  const locales = consulta.datos?.locales ?? (consulta.error ? [] : null);
  const cargar = consulta.recargar;
  const [editando, setEditando] = useState<Local | "nuevo" | null>(null);
  const [sectoresDe, setSectoresDe] = useState<Local | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrir(local: Local | "nuevo") {
    setError("");
    setEditando(local);
    setForm(
      local === "nuevo"
        ? FORM_VACIO
        : { nombre: local.nombre, direccion: local.direccion ?? "", telefono: local.telefono ?? "", activo: local.activo },
    );
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError("Escribe el nombre del local.");
    setGuardando(true);
    setError("");
    try {
      if (editando === "nuevo") {
        await api("/api/admin/locales", { method: "POST", json: form });
        avisos.exito(`Local «${form.nombre}» creado.`);
      } else if (editando) {
        await api(`/api/admin/locales/${editando.id}`, { method: "PUT", json: form });
        avisos.exito("Cambios guardados.");
      }
      setEditando(null);
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Locales"
        descripcion="Crea los locales y luego asígnalos a cada usuario."
        acciones={
          <Boton icono="mas" onClick={() => abrir("nuevo")}>
            Crear local
          </Boton>
        }
      />

      {!locales ? (
        <Cargando />
      ) : locales.length === 0 ? (
        <Vacio icono="local" titulo="Aún no hay locales">
          Presiona «Crear local» para agregar el primero.
        </Vacio>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {locales.map((l) => (
            <li key={l.id}>
              <Tarjeta className="h-full">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-2xl font-bold">{l.nombre}</h2>
                  <Insignia tono={l.activo ? "exito" : "neutro"}>{l.activo ? "Activo" : "Desactivado"}</Insignia>
                </div>
                <dl className="mt-3 space-y-1 text-lg">
                  <div>
                    <dt className="inline font-bold">Dirección: </dt>
                    <dd className="inline">{l.direccion || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Teléfono: </dt>
                    <dd className="inline">{l.telefono || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Usuarios: </dt>
                    <dd className="inline">{l.totalUsuarios}</dd>
                    <span aria-hidden="true"> · </span>
                    <dt className="inline font-bold">Productos: </dt>
                    <dd className="inline">{l.totalProductos}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Boton variante="secundario" icono="editar" onClick={() => abrir(l)}>
                    Editar
                  </Boton>
                  <Boton variante="secundario" icono="sector" onClick={() => setSectoresDe(l)}>
                    Sectores de la ciudad
                  </Boton>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nuevo" ? "Crear local" : "Editar local"}>
        <form onSubmit={guardar} className="space-y-5" noValidate>
          {error && <Mensaje tono="peligro">{error}</Mensaje>}
          <Campo etiqueta="Nombre del local" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} obligatorio autoFocus />
          <Campo etiqueta="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <Campo etiqueta="Teléfono" type="tel" inputMode="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-bold">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="size-7 accent-marca-700"
            />
            Local activo (los usuarios pueden trabajar en él)
          </label>
          <Boton type="submit" ancho cargando={guardando} icono="check">
            Guardar
          </Boton>
        </form>

        {editando && editando !== "nuevo" && (
          <section className="mt-8 border-t-2 border-gray-200 pt-6">
            <h3 className="mb-1 text-2xl font-bold">Categorías de gastos</h3>
            <p className="mb-4 text-lg text-texto-suave">Son las que eligen los vendedores al registrar un gasto.</p>
            <GestorNombres
              urlLista={`/api/admin/locales/${editando.id}/categorias-gasto`}
              clave="categorias"
              urlElemento={(id) => `/api/admin/categorias-gasto/${id}`}
              singular="categoría"
              plural="categorías"
              permiteEliminar={false}
              avisoQuitar="Dejará de aparecer para los vendedores. Los gastos ya registrados no cambian."
            />
          </section>
        )}
      </Modal>

      <Modal abierto={sectoresDe !== null} onCerrar={() => setSectoresDe(null)} titulo={sectoresDe ? `Sectores de ${sectoresDe.nombre}` : "Sectores"} tamano="lg">
        {sectoresDe && (
          <GestorNombres
            urlLista={`/api/admin/locales/${sectoresDe.id}/sectores`}
            clave="sectores"
            urlElemento={(id) => `/api/admin/sectores/${id}`}
            singular="sector"
            plural="sectores"
            permiteEliminar
            avisoQuitar="Si el sector ya se usó en facturas, solo se desactiva para no afectar el historial."
          />
        )}
      </Modal>
    </>
  );
}
