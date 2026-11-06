/**
 * Datos del cliente para la factura: identificación, nombre, número, dirección y sector.
 * Al escribir la identificación de un cliente que ya compró antes, sus datos se llenan solos.
 * El sector se elige de la lista que definió el administrador para el local.
 * El sector se elige de la lista que definió el administrador para el local.
 */
"use client";

import { useState } from "react";
import { api } from "@/lib/http";
import type { ClienteDatos, NombreActivo } from "@/tipos";
import { Mensaje } from "../ui/Basicos";
import { Campo, Selector } from "../ui/Campo";

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

  /** Busca al cliente cuando la persona termina de escribir la identificación. */
  async function autocompletar() {
    const ident = valor.identificacion.trim();
    if (ident.length < 5) return;
    setEstadoBusqueda("buscando");
    try {
      const { cliente } = await api<{ cliente: ClienteDatos | null }>(`/api/clientes/${encodeURIComponent(ident)}`);
      if (cliente) {
        // Si su sector ya no está en la lista, el selector queda vacío para que el vendedor elija uno
        const sectorVigente = sectores?.some((s) => s.nombre === cliente.sector);
        onCambio({ ...cliente, identificacion: ident, sector: sectorVigente ? cliente.sector : "" });
        setEstadoBusqueda("encontrado");
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
      : estadoBusqueda === "encontrado"
        ? "✔ Cliente encontrado: revisa que sus datos estén al día."
        : estadoBusqueda === "nuevo"
          ? "Cliente nuevo: completa sus datos."
          : "Si el cliente ya compró antes, sus datos se llenan solos.";

  return (
    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className="mb-3 text-2xl font-bold">1. Datos del cliente</legend>
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
      <Campo etiqueta="Nombre del cliente" autoComplete="off" value={valor.nombre} onChange={(e) => cambiar("nombre", e.target.value)} error={errores.nombre} obligatorio />
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
      <Campo
        etiqueta="Dirección completa (con barrio)"
        autoComplete="off"
        value={valor.direccion}
        onChange={(e) => cambiar("direccion", e.target.value)}
        error={errores.direccion}
        ayuda="Ejemplo: Calle 18 #25-30, barrio Las Cuadras"
        obligatorio
      />
      {sectores?.length === 0 ? (
        <div className="md:col-span-2">
          <Mensaje tono="alerta" titulo="Sector">
            El administrador aún no ha agregado sectores para este local
          </Mensaje>
        </div>
      ) : (
        <Selector
          className="md:col-span-2"
          etiqueta="Sector"
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
    </fieldset>
  );
}
