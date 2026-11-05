/**
 * Facturación: dos pestañas grandes para elegir el tipo de factura.
 *  - Factura normal (contado)
 *  - Crédito (a cuotas)
 */
"use client";

import { useState } from "react";
import { EncabezadoPagina } from "@/components/ui/Basicos";
import { Icono } from "@/components/ui/Icono";
import { FormularioFactura } from "@/components/facturacion/FormularioFactura";
import type { TipoFactura } from "@/tipos";

const PESTANAS: { tipo: TipoFactura; titulo: string; detalle: string }[] = [
  { tipo: "NORMAL", titulo: "Factura normal", detalle: "El cliente paga todo ahora" },
  { tipo: "CREDITO", titulo: "Crédito", detalle: "El cliente paga en cuotas" },
];

export default function PaginaFacturacion() {
  const [tipo, setTipo] = useState<TipoFactura>("NORMAL");

  return (
    <>
      <EncabezadoPagina titulo="Facturación" descripcion="Elige el tipo de factura y completa los pasos." />

      <div role="tablist" aria-label="Tipo de factura" className="mb-6 grid gap-3 sm:grid-cols-2">
        {PESTANAS.map((p) => {
          const activa = tipo === p.tipo;
          return (
            <button
              key={p.tipo}
              type="button"
              role="tab"
              id={`pestana-${p.tipo}`}
              aria-selected={activa}
              aria-controls="panel-factura"
              onClick={() => setTipo(p.tipo)}
              className={`flex items-center gap-4 rounded-2xl border-[3px] p-4 text-left transition ${
                activa ? "border-marca-700 bg-marca-700 text-white shadow-lg" : "border-gray-300 bg-white hover:border-marca-700"
              }`}
            >
              <Icono nombre={p.tipo === "NORMAL" ? "factura" : "credito"} className="size-10" />
              <span>
                <span className="block text-2xl font-bold">{p.titulo}</span>
                <span className={`text-lg ${activa ? "text-white/90" : "text-texto-suave"}`}>{p.detalle}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="panel-factura" aria-labelledby={`pestana-${tipo}`}>
        {/* "key" reinicia el formulario al cambiar de pestaña */}
        <FormularioFactura key={tipo} tipo={tipo} />
      </div>
    </>
  );
}
