/**
 * Datos del cliente para la factura: identificación, nombre, número, dirección y sector.
 * Al escribir la identificación de un cliente que ya compró antes, sus datos se llenan solos.
 */
"use client";

import { useState } from "react";
import { api } from "@/lib/http";
import type { ClienteDatos } from "@/tipos";
import { Campo } from "../ui/Campo";

export const CLIENTE_VACIO: ClienteDatos = { identificacion: "", nombre: "", telefono: "", direccion: "", sector: "" };

interface Props {
  valor: ClienteDatos;
  onCambio: (c: ClienteDatos) => void;
  errores: Partial<Record<keyof ClienteDatos, string>>;
}

export function DatosCliente({ valor, onCambio, errores }: Props) {
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
        onCambio({ ...cliente, identificacion: ident });
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
      <Campo etiqueta="Dirección" autoComplete="off" value={valor.direccion} onChange={(e) => cambiar("direccion", e.target.value)} error={errores.direccion} obligatorio />
      <Campo
        className="md:col-span-2"
        etiqueta="Sector o barrio"
        autoComplete="off"
        value={valor.sector}
        onChange={(e) => cambiar("sector", e.target.value)}
        error={errores.sector}
        obligatorio
      />
    </fieldset>
  );
}
