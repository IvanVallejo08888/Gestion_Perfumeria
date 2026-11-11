/**
 * Reportes del administrador:
 *  - Elegir local (o "Todos los locales"), año y (opcional) mes.
 *  - Dashboard: indicadores y gráficas de un local o del consolidado.
 *  - Ver las estadísticas del local en pantalla.
 *  - Descargar Excel del AÑO o del MES elegido.
 *  - Ver los gastos del local en el periodo elegido.
 */
"use client";

import { useState } from "react";
import { TablaGastos, TotalesGastos } from "@/components/compartidos/TablaGastos";
import { VistaEstadisticas } from "@/components/compartidos/VistaEstadisticas";
import { VistaDashboard } from "@/components/dashboard/VistaDashboard";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { useConsulta } from "@/hooks/useConsulta";
import { MESES } from "@/lib/formato";
import type { Estadisticas, ListaGastos } from "@/tipos";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i);
/** Valor del selector para ver el dashboard consolidado. */
const TODOS = "TODOS";

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

  // Las estadísticas, los gastos y el Excel por local necesitan UN local; el dashboard también acepta todos
  const todos = localId === TODOS;
  const unLocal = localId && !todos ? localId : null;

  const consultaDatos = useConsulta<Estadisticas>(unLocal ? `/api/admin/estadisticas?localId=${unLocal}&anio=${anio}` : null);
  const { datos, cargando } = consultaDatos;
  const consultaGastos = useConsulta<ListaGastos>(unLocal ? `/api/admin/gastos?localId=${unLocal}&anio=${anio}${mes ? `&mes=${mes}` : ""}` : null);
  const gastos = unLocal ? consultaGastos.datos : null;
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
                <option value={TODOS}>Todos los locales (consolidado)</option>
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

            {/* Descargas: enlaces directos (el navegador descarga el archivo). El Excel por local necesita un local. */}
            <div className={unLocal ? "mt-5 flex flex-col gap-3 sm:flex-row" : "hidden"}>
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

            {/* Consolidado: todos los locales en un solo archivo (usa el año y el mes elegidos arriba) */}
            <div className="mt-6 border-t-2 border-gray-200 pt-5">
              <p className="mb-3 text-lg text-gray-700">
                <strong>Todos los locales:</strong> compara las ventas de cada local y ve la cartera completa en un solo archivo.
              </p>
              <a
                href={`/api/admin/reportes/consolidado?anio=${anio}${mes ? `&mes=${mes}` : ""}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-exito-700 bg-white px-5 text-lg font-bold text-exito-800 hover:bg-exito-50"
              >
                <Icono nombre="descargar" />
                Descargar consolidado de {mes ? `${MESES[mes - 1]} ${anio}` : `todo ${anio}`}
              </a>
            </div>
          </Tarjeta>

          {localId && <VistaDashboard anio={anio} mes={mes || undefined} localId={unLocal ?? undefined} />}

          {todos ? (
            <div className="mt-10">
              <Mensaje tono="info" titulo="Estás viendo todos los locales">
                Las estadísticas mes a mes, los gastos y el Excel por local se ven eligiendo un local. El consolidado en Excel se descarga con el botón de arriba.
              </Mensaje>
            </div>
          ) : (
            <>
              <h2 className="mt-10 mb-4 text-2xl font-bold">Estadísticas del año {anio}</h2>
              {cargando || !datos ? <Cargando texto="Calculando estadísticas…" /> : <VistaEstadisticas datos={datos} mes={mes || undefined} />}
            </>
          )}

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
