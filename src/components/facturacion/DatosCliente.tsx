/**
 * Datos del cliente para la factura: identificación, nombre, número, dirección y sector.
 * - El cliente se busca SOLO por cédula (para no confundir clientes con nombres parecidos).
 *   La búsqueda va directo a los clientes del local: aunque tenga 0 compras o todas sus ventas
 *   anuladas, sus datos se llenan solos.
 * - Se busca sola cuando la cédula tiene 6 dígitos o más y la persona deja de escribir 500 ms,
 *   además de al salir del campo o presionar Enter (en celular "salir del campo" no siempre pasa).
 * - Si la cédula está en OTRO local, se ofrece copiar sus datos; al facturar queda como cliente
 *   de este local, con su propio historial.
 * - Si el servidor falla, se avisa para intentar de nuevo (no se da por "cliente nuevo").
 * El sector se elige de la lista que definió el administrador para el local.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  AYUDA_IDENTIFICACION,
  debeBuscarAlEscribir,
  ESPERA_BUSQUEDA_MS,
  estadoTrasBuscar,
  normalizarIdentificacion,
  puedeBuscarIdentificacion,
  type EstadoBusquedaCliente,
  type RespuestaBusquedaCliente,
} from "@/lib/busqueda-cliente";
import { api } from "@/lib/http";
import type { ClienteDatos, NombreActivo } from "@/tipos";
import { Mensaje } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Campo, Selector } from "../ui/Campo";

/** Cada campo ocupa 3 filas de la cuadrícula (etiqueta, campo, ayuda) y se alinea con su vecino. */
const EN_FILA = "md:row-span-3 md:grid md:grid-rows-subgrid md:gap-y-0 md:[&>label]:self-end";

export const CLIENTE_VACIO: ClienteDatos = { identificacion: "", nombre: "", telefono: "", direccion: "", sector: "" };

interface Props {
  valor: ClienteDatos;
  onCambio: (c: ClienteDatos) => void;
  errores: Partial<Record<keyof ClienteDatos, string>>;
  /** Sectores activos del local (null mientras cargan). */
  sectores: NombreActivo[] | null;
}

export function DatosCliente({ valor, onCambio, errores, sectores }: Props) {
  const [estado, setEstado] = useState<EstadoBusquedaCliente>("");
  /** Datos del cliente encontrado en otro local, esperando que el vendedor acepte usarlos. */
  const [deOtroLocal, setDeOtroLocal] = useState<ClienteDatos | null>(null);
  /** Solo se busca sola si la cédula la escribió la persona (no al restaurar un borrador). */
  const escribiendo = useRef(false);
  /** Última cédula buscada (para no repetir la búsqueda al salir del campo). */
  const ultimaBuscada = useRef<string | null>(null);
  /** Número de la búsqueda en curso: las respuestas viejas se ignoran. */
  const peticion = useRef(0);

  const cambiar = (campo: keyof ClienteDatos, v: string) => onCambio({ ...valor, [campo]: v });

  /** Llena la factura con un cliente ya registrado. */
  function aplicarCliente(cliente: ClienteDatos) {
    // Si su sector no está en la lista de este local, el selector queda vacío para que el vendedor elija uno
    const sectorVigente = sectores?.some((s) => s.nombre === cliente.sector);
    onCambio({ ...cliente, sector: sectorVigente ? cliente.sector : "" });
  }

  async function buscar(texto: string) {
    const ident = normalizarIdentificacion(texto);
    if (!puedeBuscarIdentificacion(ident) || ultimaBuscada.current === ident) return;
    ultimaBuscada.current = ident;
    const n = ++peticion.current;
    setEstado("buscando");
    setDeOtroLocal(null);

    let respuesta: RespuestaBusquedaCliente;
    try {
      respuesta = await api<RespuestaBusquedaCliente>(`/api/clientes/buscar-identificacion?identificacion=${encodeURIComponent(ident)}`);
    } catch {
      if (n !== peticion.current) return;
      ultimaBuscada.current = null; // así, al salir del campo o con Enter, se intenta de nuevo
      setEstado("error");
      return;
    }
    if (n !== peticion.current) return;

    const nuevoEstado = estadoTrasBuscar({ ok: true, respuesta });
    if (respuesta.cliente && nuevoEstado === "encontrado") aplicarCliente({ ...respuesta.cliente, identificacion: ident });
    if (respuesta.cliente && nuevoEstado === "otro-local") setDeOtroLocal({ ...respuesta.cliente, identificacion: ident });
    setEstado(nuevoEstado);
  }

  // Búsqueda automática: 6 dígitos o más y 500 ms sin escribir
  useEffect(() => {
    if (!escribiendo.current || !debeBuscarAlEscribir(valor.identificacion)) return;
    const espera = setTimeout(() => buscar(valor.identificacion), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor.identificacion]);

  function usarDatosOtroLocal() {
    if (!deOtroLocal) return;
    aplicarCliente(deOtroLocal);
    setDeOtroLocal(null);
    setEstado("copiado");
  }

  function noUsarDatosOtroLocal() {
    setDeOtroLocal(null);
    setEstado("nuevo");
  }

  return (
    <fieldset className="grid items-start gap-5 md:grid-cols-2">
      <legend className="titulo-seccion mb-3 text-2xl font-bold">1. Datos del cliente</legend>
      <div className="grid gap-3 md:col-span-2">
        <Campo
          etiqueta="Identificación del cliente"
          inputMode="numeric"
          autoComplete="off"
          value={valor.identificacion}
          onChange={(e) => {
            const nueva = normalizarIdentificacion(e.target.value);
            if (nueva === valor.identificacion) return; // p. ej. escribió una letra o un punto: no cambia nada
            escribiendo.current = true;
            peticion.current++; // si había una búsqueda en curso, su respuesta ya no aplica
            ultimaBuscada.current = null; // cédula distinta: se puede volver a buscar (aunque la borre y la escriba igual)
            cambiar("identificacion", nueva);
            setEstado("");
            setDeOtroLocal(null);
          }}
          onBlur={() => buscar(valor.identificacion)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar(valor.identificacion);
            }
          }}
          error={errores.identificacion ?? (estado === "error" ? AYUDA_IDENTIFICACION.error : undefined)}
          ayuda={AYUDA_IDENTIFICACION[estado]}
          obligatorio
        />
        {deOtroLocal && estado === "otro-local" && (
          <Mensaje tono="info" titulo="Este cliente está registrado en otro local. ¿Usar sus datos?">
            <p>
              {deOtroLocal.nombre} · Tel. {deOtroLocal.telefono}
            </p>
            <p className="text-base">Al facturar quedará registrado también en este local, con su propio historial.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Boton type="button" pequeno onClick={usarDatosOtroLocal}>
                Usar sus datos
              </Boton>
              <Boton type="button" pequeno variante="secundario" onClick={noUsarDatosOtroLocal}>
                No, escribirlos
              </Boton>
            </div>
          </Mensaje>
        )}
      </div>
      <Campo
        etiqueta="Nombre del cliente"
        autoComplete="off"
        value={valor.nombre}
        onChange={(e) => cambiar("nombre", e.target.value)}
        error={errores.nombre}
        obligatorio
      />
      <Campo
        etiqueta="Número de teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={valor.telefono}
        onChange={(e) => cambiar("telefono", e.target.value)}
        error={errores.telefono}
        obligatorio
      />
      {/*
        Dirección y sector en la misma fila (en celular, uno debajo del otro). Con subgrid, la etiqueta,
        el campo y la ayuda de los dos comparten filas: los campos quedan alineados aunque una etiqueta
        ocupe dos líneas (por ejemplo a 768 px o con letra grande).
      */}
      <div className="grid gap-5 md:col-span-2 md:grid-cols-2">
        <Campo
          className={EN_FILA}
          etiqueta="Dirección con barrio"
          autoComplete="off"
          value={valor.direccion}
          onChange={(e) => cambiar("direccion", e.target.value)}
          error={errores.direccion}
          ayuda="Ejemplo: Calle 18 #25-30, barrio Las Cuadras"
          obligatorio
        />
        {sectores?.length === 0 ? (
          <div className="md:row-span-3 md:self-end">
            <Mensaje tono="alerta" titulo="Sector">
              El administrador aún no ha agregado sectores para este local
            </Mensaje>
          </div>
        ) : (
          <Selector
            className={EN_FILA}
            etiqueta="Sector"
            ayuda="Zona de la ciudad donde vive el cliente."
            value={sectores?.some((s) => s.nombre === valor.sector) ? valor.sector : ""}
            onChange={(e) => cambiar("sector", e.target.value)}
            error={errores.sector}
            obligatorio
          >
            <option value="">{sectores ? "Elige un sector" : "Cargando sectores…"}</option>
            {sectores?.map((s) => (
              <option key={s.id} value={s.nombre}>
                {s.nombre}
              </option>
            ))}
          </Selector>
        )}
      </div>
    </fieldset>
  );
}
