/**
 * Reportes del local del vendedor:
 *  - Dashboard (indicadores y gráficas del año o mes elegido).
 *  - Estadísticas del año con detalle mensual y descarga en Excel.
 */
"use client";

import { useState } from "react";
import { VistaEstadisticas } from "@/components/compartidos/VistaEstadisticas";
import { VistaDashboard } from "@/components/dashboard/VistaDashboard";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
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
          <Selector etiqueta="Mes (opcional)" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todo el año</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Selector>
        </div>

        {/* Descargas: enlaces directos (el navegador descarga el archivo) */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/api/reportes/excel?anio=${anio}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-exito-700 px-5 text-lg font-bold text-white hover:bg-exito-800"
          >
            <Icono nombre="descargar" />
            Descargar Excel del año {anio}
          </a>
          <a
            href={mes ? `/api/reportes/excel?anio=${anio}&mes=${mes}` : undefined}
            aria-disabled={!mes}
            onClick={(e) => !mes && e.preventDefault()}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 text-lg font-bold ${
              mes ? "border-exito-700 bg-white text-exito-800 hover:bg-exito-50" : "cursor-not-allowed border-linea-fuerte text-texto-tenue"
            }`}
          >
            <Icono nombre="descargar" />
            {mes ? `Descargar Excel de ${MESES[mes - 1]}` : "Elige un mes para el Excel mensual"}
          </a>
        </div>
      </Tarjeta>

      <VistaDashboard anio={anio} mes={mes || undefined} puedeAgregarUnidades />

      <h2 className="mt-10 mb-4 text-2xl font-bold">Estadísticas del año {anio}</h2>
      {error ? <Mensaje tono="peligro">{error}</Mensaje> : !datos || cargando ? <Cargando /> : <VistaEstadisticas datos={datos} mes={mes || undefined} />}
    </>
  );
}
