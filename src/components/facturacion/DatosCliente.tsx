/**
 * Datos del cliente para la factura: nombre, identificación, número, dirección y sector.
 * - Al escribir el nombre aparecen sugerencias de clientes del local (sin importar mayúsculas ni tildes);
 *   al elegir una, sus datos se llenan solos. Si no aparece, se sigue escribiendo: es un cliente nuevo.
 * - Al escribir la identificación de un cliente que ya compró antes, sus datos también se llenan solos.
 * El sector se elige de la lista que definió el administrador para el local.
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { api } from "@/lib/http";
import { MIN_LETRAS_BUSQUEDA_CLIENTE } from "@/lib/validaciones";
import type { ClienteDatos, NombreActivo } from "@/tipos";
import { Mensaje } from "../ui/Basicos";
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
  const [estadoBusqueda, setEstadoBusqueda] = useState<"" | "buscando" | "encontrado" | "nuevo">("");

  const cambiar = (campo: keyof ClienteDatos, v: string) => onCambio({ ...valor, [campo]: v });

  /** Llena la factura con un cliente ya registrado (desde la identificación o desde las sugerencias). */
  function aplicarCliente(cliente: ClienteDatos) {
    // Si su sector ya no está en la lista, el selector queda vacío para que el vendedor elija uno
    const sectorVigente = sectores?.some((s) => s.nombre === cliente.sector);
    onCambio({ ...cliente, sector: sectorVigente ? cliente.sector : "" });
    setEstadoBusqueda("encontrado");
  }

  /* ------------------------- Sugerencias por nombre ------------------------- */
  const idLista = useId();
  // Solo se busca mientras la persona escribe el nombre (no al elegir una sugerencia ni al llenar por identificación)
  const escribiendoNombre = useRef(false);
  const [sugerencias, setSugerencias] = useState<ClienteDatos[] | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);
  const nombreBuscado = useValorDiferido(valor.nombre.trim(), 300);

  useEffect(() => {
    if (!escribiendoNombre.current) return;
    if (nombreBuscado.length < MIN_LETRAS_BUSQUEDA_CLIENTE) {
      setSugerencias(null);
      return;
    }
    let vigente = true;
    api<{ clientes: ClienteDatos[] }>(`/api/clientes/sugerencias?nombre=${encodeURIComponent(nombreBuscado)}`)
      .then(({ clientes }) => {
        if (!vigente || !escribiendoNombre.current) return;
        setSugerencias(clientes);
        setActiva(-1);
        setListaAbierta(true);
      })
      .catch(() => vigente && setSugerencias(null));
    return () => {
      vigente = false;
    };
  }, [nombreBuscado]);

  function elegirSugerencia(cliente: ClienteDatos) {
    escribiendoNombre.current = false;
    setListaAbierta(false);
    setSugerencias(null);
    aplicarCliente(cliente);
  }

  const mostrarLista = listaAbierta && !!sugerencias && sugerencias.length > 0;
  const ayudaNombre =
    estadoBusqueda === "encontrado"
      ? "✔ Cliente encontrado: revisa que sus datos estén al día."
      : sugerencias && sugerencias.length === 0
        ? "No hay clientes con ese nombre: es un cliente nuevo, completa sus datos."
        : mostrarLista
          ? "Elige al cliente de la lista, o sigue escribiendo si es nuevo."
          : "Si el cliente ya compró antes, aparecerá en una lista al escribir su nombre.";

  /* ------------------------- Búsqueda por identificación ------------------------- */

  /** Busca al cliente cuando la persona termina de escribir la identificación. */
  async function autocompletar() {
    const ident = valor.identificacion.trim();
    if (ident.length < 5) return;
    setEstadoBusqueda("buscando");
    try {
      const { cliente } = await api<{ cliente: ClienteDatos | null }>(`/api/clientes/buscar-identificacion?identificacion=${encodeURIComponent(ident)}`);
      if (cliente) {
        escribiendoNombre.current = false;
        setSugerencias(null);
        aplicarCliente({ ...cliente, identificacion: ident });
      } else {
        setEstadoBusqueda("nuevo");
      }
    } catch {
      setEstadoBusqueda("");
    }
  }

  const ayudaIdentificacion =
    estadoBusqueda === "buscando"
      ? "Buscando cliente…"
      : estadoBusqueda === "nuevo"
        ? "Cliente nuevo: completa sus datos."
        : "Si el cliente ya compró antes, sus datos se llenan solos.";

  return (
    <fieldset className="grid items-start gap-5 md:grid-cols-2">
      <legend className="titulo-seccion mb-3 text-2xl font-bold">1. Datos del cliente</legend>
      <div className="relative md:col-span-2">
        <Campo
          etiqueta="Nombre del cliente"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={idLista}
          aria-activedescendant={mostrarLista && activa >= 0 ? `${idLista}-${activa}` : undefined}
          value={valor.nombre}
          onChange={(e) => {
            escribiendoNombre.current = true;
            cambiar("nombre", e.target.value);
            if (estadoBusqueda === "encontrado") setEstadoBusqueda("");
          }}
          onFocus={() => {
            if (sugerencias?.length) setListaAbierta(true);
          }}
          onBlur={() => setListaAbierta(false)}
          onKeyDown={(e) => {
            if (!mostrarLista) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const paso = e.key === "ArrowDown" ? 1 : -1;
              setActiva((a) => (a + paso + sugerencias!.length) % sugerencias!.length);
            } else if (e.key === "Enter" && activa >= 0) {
              e.preventDefault();
              elegirSugerencia(sugerencias![activa]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setListaAbierta(false);
            }
          }}
          error={errores.nombre}
          ayuda={ayudaNombre}
          obligatorio
        />
        {mostrarLista && (
          <ul
            id={idLista}
            role="listbox"
            aria-label="Clientes encontrados"
            className="absolute inset-x-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border-2 border-marca-700 bg-tarjeta shadow-xl"
          >
            {sugerencias!.map((c, i) => (
              <li
                key={c.identificacion}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === activa}
                // onMouseDown: elige antes de que el campo pierda el foco y se cierre la lista
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegirSugerencia(c);
                }}
                className={`flex min-h-12 cursor-pointer flex-col justify-center border-b border-linea px-4 py-2 last:border-b-0 ${
                  i === activa ? "bg-superficie-apagada outline-2 -outline-offset-2 outline-marca-700" : "hover:bg-superficie-apagada"
                }`}
              >
                <span className="text-lg font-bold text-texto">{c.nombre}</span>
                <span className="text-base text-texto-suave">
                  Identificación {c.identificacion} · Tel. {c.telefono}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Campo
        etiqueta="Identificación del cliente"
        inputMode="numeric"
        autoComplete="off"
        value={valor.identificacion}
        onChange={(e) => {
          cambiar("identificacion", e.target.value.replace(/\D/g, ""));
          setEstadoBusqueda("");
        }}
        onBlur={autocompletar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            autocompletar();
          }
        }}
        error={errores.identificacion}
        ayuda={ayudaIdentificacion}
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
