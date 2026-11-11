/**
 * Administra una lista de nombres de un local: sirve para los sectores de la ciudad,
 * las marcas y las categorías de gastos, que funcionan igual.
 *  - Agregar uno, o pegar varios a la vez (uno por línea).
 *  - Renombrar.
 *  - Quitar: sectores y marcas se eliminan (o se desactivan si ya se usaron); las categorías solo se desactivan.
 *  - Reactivar lo que esté desactivado.
 */
"use client";

import { useState, type FormEvent } from "react";
import { Cargando, Insignia, Mensaje } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Campo } from "../ui/Campo";
import { Confirmar } from "../ui/Modal";
import { Desplegable } from "../ui/Desplegable";
import { useAvisos } from "../ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { api } from "@/lib/http";
import type { NombreActivo } from "@/tipos";

interface Props {
  /** Dirección que lista (GET) y agrega (POST). Debe responder { [clave]: NombreActivo[] }. */
  urlLista: string;
  clave: "sectores" | "marcas" | "categorias";
  /** Dirección de un elemento, para editar (PUT) y eliminar (DELETE). */
  urlElemento: (id: string) => string;
  /** Textos: "sector" / "sectores", "categoría" / "categorías". */
  singular: string;
  plural: string;
  /** true: el botón elimina (DELETE). false: el botón solo desactiva (PUT). */
  permiteEliminar: boolean;
  /** Mensaje de confirmación antes de quitar un elemento. */
  avisoQuitar: string;
  /** Si al eliminar quedó solo desactivado, por qué: "ya se usó en facturas". */
  motivoDesactivado?: string;
}

type Resultado = { agregados: number; reactivados: number; repetidos: number };

export function GestorNombres({
  urlLista,
  clave,
  urlElemento,
  singular,
  plural,
  permiteEliminar,
  avisoQuitar,
  motivoDesactivado = "ya se usó",
}: Props) {
  const avisos = useAvisos();
  const consulta = useConsulta<Record<string, NombreActivo[]>>(urlLista);
  const lista = consulta.datos?.[clave] ?? null;

  const [nombre, setNombre] = useState("");
  const [varios, setVarios] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<NombreActivo | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [quitando, setQuitando] = useState<NombreActivo | null>(null);

  async function agregar(nombres: string[]): Promise<boolean> {
    if (nombres.length === 0) {
      setError(`Escribe al menos un ${singular}.`);
      return false;
    }
    setGuardando(true);
    setError("");
    try {
      const r = await api<Resultado>(urlLista, { method: "POST", json: { nombres } });
      const partes = [
        r.agregados && `${r.agregados} agregado(s)`,
        r.reactivados && `${r.reactivados} reactivado(s)`,
        r.repetidos && `${r.repetidos} ya existía(n)`,
      ].filter(Boolean);
      avisos.exito(partes.join(" · "));
      await consulta.recargar();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function agregarUno(e: FormEvent) {
    e.preventDefault();
    if (await agregar(nombre.trim() ? [nombre.trim()] : [])) setNombre("");
  }

  async function agregarVarios() {
    const nombres = varios.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (await agregar(nombres)) setVarios("");
  }

  async function guardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setError("");
    try {
      await api(urlElemento(editando.id), { method: "PUT", json: { nombre: nombreEditado } });
      setEditando(null);
      await consulta.recargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function reactivar(item: NombreActivo) {
    setError("");
    try {
      await api(urlElemento(item.id), { method: "PUT", json: { activo: true } });
      await consulta.recargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function quitar() {
    if (!quitando) return;
    setGuardando(true);
    setError("");
    try {
      if (permiteEliminar) {
        const { resultado } = await api<{ resultado: "eliminado" | "desactivado" }>(urlElemento(quitando.id), { method: "DELETE" });
        avisos.exito(
          resultado === "eliminado"
            ? `«${quitando.nombre}» se eliminó.`
            : `«${quitando.nombre}» ${motivoDesactivado}: quedó desactivado para no afectar el historial.`,
        );
      } else {
        await api(urlElemento(quitando.id), { method: "PUT", json: { activo: false } });
        avisos.exito(`«${quitando.nombre}» quedó desactivada.`);
      }
      setQuitando(null);
      await consulta.recargar();
    } catch (e) {
      setError((e as Error).message);
      setQuitando(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Mensaje tono="peligro">{error}</Mensaje>}
      {consulta.error && <Mensaje tono="peligro">{consulta.error}</Mensaje>}

      <form onSubmit={agregarUno} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo className="sm:flex-1" etiqueta={`Nombre del ${singular}`} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Boton type="submit" icono="mas" cargando={guardando}>
          Agregar
        </Boton>
      </form>

      <Desplegable titulo="Pegar varios a la vez">
        <label className="mb-1.5 block text-lg font-bold">
          Escribe o pega un {singular} por línea
          <textarea
            rows={5}
            value={varios}
            onChange={(e) => setVarios(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border-2 border-borde px-4 py-2.5 text-lg font-normal focus:border-marca-700 focus:outline-none focus:ring-4 focus:ring-marca-200"
          />
        </label>
        <Boton variante="secundario" icono="mas" cargando={guardando} onClick={agregarVarios}>
          Agregar todos
        </Boton>
      </Desplegable>

      {!lista ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <p className="rounded-xl bg-gray-100 p-4 text-lg">Este local aún no tiene {plural}.</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((item) => (
            <li key={item.id} className="rounded-xl border-2 border-gray-200 p-3">
              {editando?.id === item.id ? (
                <form onSubmit={guardarEdicion} className="space-y-3">
                  <Campo etiqueta={`Nuevo nombre de «${item.nombre}»`} maxLength={80} value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value)} autoFocus />
                  <div className="flex flex-wrap gap-2">
                    <Boton pequeno type="submit" icono="check" cargando={guardando}>
                      Guardar
                    </Boton>
                    <Boton pequeno variante="secundario" onClick={() => setEditando(null)}>
                      Cancelar
                    </Boton>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-lg font-bold break-words">
                    {item.nombre} {!item.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Boton
                      pequeno
                      variante="secundario"
                      icono="editar"
                      aria-label={`Editar ${item.nombre}`}
                      onClick={() => {
                        setEditando(item);
                        setNombreEditado(item.nombre);
                      }}
                    >
                      Editar
                    </Boton>
                    {item.activo ? (
                      <Boton pequeno variante="secundario" icono="basura" aria-label={`${permiteEliminar ? "Eliminar" : "Desactivar"} ${item.nombre}`} onClick={() => setQuitando(item)}>
                        {permiteEliminar ? "Eliminar" : "Desactivar"}
                      </Boton>
                    ) : (
                      <Boton pequeno variante="secundario" icono="check" aria-label={`Reactivar ${item.nombre}`} onClick={() => reactivar(item)}>
                        Reactivar
                      </Boton>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Confirmar
        abierto={quitando !== null}
        titulo={quitando ? `${permiteEliminar ? "Eliminar" : "Desactivar"} «${quitando.nombre}»` : ""}
        mensaje={avisoQuitar}
        textoConfirmar={permiteEliminar ? "Sí, eliminar" : "Sí, desactivar"}
        peligro
        cargando={guardando}
        onConfirmar={quitar}
        onCerrar={() => setQuitando(null)}
      />
    </div>
  );
}
