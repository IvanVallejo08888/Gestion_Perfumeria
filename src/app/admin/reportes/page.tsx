/**
 * Reportes del administrador:
 *  - Elegir local, año y (opcional) mes.
 *  - Ver las estadísticas del local en pantalla.
 *  - Descargar Excel del AÑO o del MES elegido.
 *  - Ver los gastos del local en el periodo elegido.
 */
"use client";

import { useState } from "react";
import { TablaGastos, TotalesGastos } from "@/components/compartidos/TablaGastos";
import { VistaEstadisticas } from "@/components/compartidos/VistaEstadisticas";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { useConsulta } from "@/hooks/useConsulta";
import { MESES } from "@/lib/formato";
import type { Estadisticas, ListaGastos } from "@/tipos";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i);

export default function ReportesAdmin() {
  const [localId, setLocalId] = useState("");
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [mes, setMes] = useState(0); // 0 = todo el año

  const consultaLocales = useConsulta<{ locales: { id: string; nombre: string }[] }>("/api/admin/locales", {
    alCargar: (d) => {
      if (d.locales[0]) setLocalId((actual) => actual || d.locales[0].id);
    },
  });
  const locales = consultaLocales.datos?.locales ?? null;

  const consultaDatos = useConsulta<Estadisticas>(localId ? `/api/admin/estadisticas?localId=${localId}&anio=${anio}` : null);
  const { datos, cargando } = consultaDatos;
  const consultaGastos = useConsulta<ListaGastos>(localId ? `/api/admin/gastos?localId=${localId}&anio=${anio}${mes ? `&mes=${mes}` : ""}` : null);
  const gastos = consultaGastos.datos;
  const error = consultaLocales.error || consultaDatos.error || consultaGastos.error;

  const urlExcel = (conMes: boolean) =>
    `/api/admin/reportes/excel?localId=${localId}&anio=${anio}${conMes && mes ? `&mes=${mes}` : ""}`;

  return (
    <>
      <EncabezadoPagina titulo="Reportes por local" descripcion="Consulta las estadísticas y descarga los reportes en Excel." />

      {error && (
        <div className="mb-6">
          <Mensaje tono="peligro">{error}</Mensaje>
        </div>
      )}

      {!locales ? (
        <Cargando />
      ) : locales.length === 0 ? (
        <Vacio icono="local" titulo="Aún no hay locales">
          Crea un local para ver sus reportes.
        </Vacio>
      ) : (
        <>
          <Tarjeta className="mb-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Selector etiqueta="Local" value={localId} onChange={(e) => setLocalId(e.target.value)}>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </Selector>
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
                href={urlExcel(false)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-exito-700 px-5 text-lg font-bold text-white hover:bg-exito-800"
              >
                <Icono nombre="descargar" />
                Descargar Excel del año {anio}
              </a>
              <a
                href={mes ? urlExcel(true) : undefined}
                aria-disabled={!mes}
                onClick={(e) => !mes && e.preventDefault()}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 text-lg font-bold ${
                  mes ? "border-exito-700 bg-white text-exito-800 hover:bg-exito-50" : "cursor-not-allowed border-gray-300 text-gray-500"
                }`}
              >
                <Icono nombre="descargar" />
                {mes ? `Descargar Excel de ${MESES[mes - 1]}` : "Elige un mes para el Excel mensual"}
              </a>
            </div>
          </Tarjeta>

          {cargando || !datos ? <Cargando texto="Calculando estadísticas…" /> : <VistaEstadisticas datos={datos} mes={mes || undefined} />}

          {gastos && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl font-bold">
                Gastos · {mes ? `${MESES[mes - 1]} de ` : "año "}
                {anio}
              </h2>
              <TotalesGastos datos={gastos} />
              <TablaGastos gastos={gastos.gastos} />
            </section>
          )}
        </>
      )}
    </>
  );
}
