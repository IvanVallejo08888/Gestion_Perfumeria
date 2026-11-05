/** Reportes y estadísticas del local del vendedor (por año, con detalle mensual). */
"use client";

import { useState } from "react";
import { VistaEstadisticas } from "@/components/compartidos/VistaEstadisticas";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { Selector } from "@/components/ui/Campo";
import { useConsulta } from "@/hooks/useConsulta";
import { MESES } from "@/lib/formato";
import type { Estadisticas } from "@/tipos";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i);

export default function ReportesVendedor() {
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [mes, setMes] = useState(0);
  const { datos, error, cargando } = useConsulta<Estadisticas>(`/api/estadisticas?anio=${anio}`);

  return (
    <>
      <EncabezadoPagina titulo="Reportes y estadísticas" descripcion={datos ? `Local: ${datos.local.nombre}` : undefined} />

      <Tarjeta className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Resaltar mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todo el año</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Selector>
        </div>
      </Tarjeta>

      {error ? <Mensaje tono="peligro">{error}</Mensaje> : !datos || cargando ? <Cargando /> : <VistaEstadisticas datos={datos} mes={mes || undefined} />}
    </>
  );
}
