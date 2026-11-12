/**
 * Dashboard de reportes (lo usan el vendedor y el administrador, arriba de las estadísticas).
 *
 *  - Indicadores en tarjetas.
 *  - Ventas del periodo: top 10 perfumes y cortes por público, tipo, marca y tamaño.
 *  - Contado vs crédito mes a mes (siempre los 12 meses del año).
 *  - Inventario de hoy: stock por género y perfumes por reponer.
 *
 * Todo llega ya calculado desde GET /api/dashboard. Celular: una gráfica por fila;
 * escritorio: dos por fila.
 */
"use client";

import { useState } from "react";
import { ModalAgregarUnidades } from "@/components/inventario/ModalesStock";
import { Cargando, Mensaje } from "@/components/ui/Basicos";
import { Icono } from "@/components/ui/Icono";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { CLAVE_OTRAS, CLAVE_SIN_CATEGORIA, hayDatos } from "@/lib/dashboard";
import { MESES, pesos } from "@/lib/formato";
import type { CorteVenta, Dashboard, ProductoCritico, ProductoTop } from "@/tipos";
import { BarrasHorizontales, GraficaMensual, TarjetaGrafica, type FilaBarra } from "./Graficas";
import { InventarioDashboard } from "./InventarioDashboard";
import { TarjetasKpi } from "./TarjetasKpi";

interface Props {
  anio: number;
  /** 0 o sin valor = todo el año. */
  mes?: number;
  /** Solo administrador: local elegido; vacío = consolidado de todos los locales. */
  localId?: string;
  /** Vendedor: puede sumar unidades a los perfumes por reponer. */
  puedeAgregarUnidades?: boolean;
}

type Medida = "unidades" | "valor";

const unidades = (n: number) => `${n} ${n === 1 ? "unidad" : "unidades"}`;
const detalleVenta = (c: { unidades: number; valor: number }): [string, string][] => [
  ["Unidades", String(c.unidades)],
  ["Valor vendido", pesos(c.valor)],
];

/** Cortes por categoría: la barra es el valor vendido y las unidades van junto al nombre. */
const filasDeCorte = (cortes: CorteVenta[]): FilaBarra[] =>
  cortes.map((c) => ({
    clave: c.clave,
    etiqueta: c.etiqueta,
    valor: c.valor,
    textoValor: pesos(c.valor),
    secundario: unidades(c.unidades),
    detalle: detalleVenta(c),
    tenue: c.clave === CLAVE_SIN_CATEGORIA || c.clave === CLAVE_OTRAS,
  }));

const filasDeTop = (top: ProductoTop[], medida: Medida): FilaBarra[] =>
  top.map((p, i) => ({
    clave: `${i}-${p.nombre}`,
    etiqueta: `${i + 1}. ${p.nombre}`,
    valor: medida === "unidades" ? p.unidades : p.valor,
    textoValor: medida === "unidades" ? String(p.unidades) : pesos(p.valor),
    secundario: medida === "unidades" ? pesos(p.valor) : unidades(p.unidades),
    detalle: detalleVenta(p),
  }));

export function VistaDashboard({ anio, mes, localId, puedeAgregarUnidades = false }: Props) {
  const avisos = useAvisos();
  const url = `/api/dashboard?anio=${anio}${mes ? `&mes=${mes}` : ""}${localId ? `&localId=${localId}` : ""}`;
  const consulta = useConsulta<Dashboard>(url);
  const datos = consulta.datos;

  const [medida, setMedida] = useState<Medida>("unidades");
  const [reponiendo, setReponiendo] = useState<ProductoCritico | null>(null);

  if (consulta.error) return <Mensaje tono="peligro">{consulta.error}</Mensaje>;
  if (!datos) return <Cargando texto="Calculando el dashboard…" />;

  const periodo = datos.mes ? `${MESES[datos.mes - 1]} ${datos.anio}` : `año ${datos.anio}`;
  const top = medida === "unidades" ? datos.topPorUnidades : datos.topPorValor;

  const cortes: { titulo: string; columna: string; datos: CorteVenta[] }[] = [
    { titulo: "Ventas por Hombre, Niño, Mujer y Niña", columna: "Público", datos: datos.porPublico },
    { titulo: "Ventas por tipo", columna: "Tipo", datos: datos.porTipo },
    { titulo: "Ventas por marca", columna: "Marca", datos: datos.porMarca },
    { titulo: "Ventas por tamaño", columna: "Tamaño", datos: datos.porTamano },
  ];

  return (
    // Mientras llega un periodo nuevo se ve el anterior atenuado (la pantalla no salta)
    <div className={`space-y-8 ${consulta.cargando ? "opacity-60" : ""}`} aria-busy={consulta.cargando}>
      <section aria-labelledby="dashboard-resumen" className="space-y-4">
        <h2 id="dashboard-resumen" className="text-2xl font-bold">
          Resumen · {periodo}
          {!datos.alcance.localId && <span className="block text-lg font-normal text-texto-suave">Todos los locales</span>}
        </h2>
        <TarjetasKpi kpis={datos.kpis} periodo={periodo} />
      </section>

      <section aria-labelledby="dashboard-ventas" className="space-y-4">
        <div>
          <h2 id="dashboard-ventas" className="text-2xl font-bold">
            Ventas · {periodo}
          </h2>
          <p className="text-base text-texto-suave">
            La categoría es la que tenía cada perfume el día de la venta. Las ventas anteriores a la clasificación salen como «Sin categoría».
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <TarjetaGrafica
            titulo="Top 10 perfumes más vendidos"
            vacio={top.length === 0}
            className="xl:col-span-2"
            acciones={
              <div role="group" aria-label="Ordenar los más vendidos por" className="flex flex-wrap items-center gap-2">
                {/* Fila flexible: cada botón toma el ancho de su texto, así caben con letra A++ a 360px */}
                <span className="basis-full text-lg font-bold sm:mr-1 sm:basis-auto">Ordenar por:</span>
                {(
                  [
                    ["unidades", "Unidades"],
                    ["valor", "Valor"],
                  ] as const
                ).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={medida === valor}
                    onClick={() => setMedida(valor)}
                    className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border-2 px-3 text-lg font-bold sm:flex-none sm:px-4 ${
                      medida === valor ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-tarjeta hover:border-marca-700 hover:bg-marca-50"
                    }`}
                  >
                    {medida === valor && <Icono nombre="check" className="size-5 shrink-0" />}
                    {texto}
                  </button>
                ))}
              </div>
            }
          >
            <BarrasHorizontales titulo={`Top 10 perfumes más vendidos · ${periodo}`} columna="Perfume" filas={filasDeTop(top, medida)} />
          </TarjetaGrafica>

          {cortes.map((c) => (
            <TarjetaGrafica key={c.titulo} titulo={c.titulo} descripcion="Valor vendido y unidades." vacio={!hayDatos(c.datos)}>
              <BarrasHorizontales titulo={`${c.titulo} · ${periodo}`} columna={c.columna} filas={filasDeCorte(c.datos)} />
            </TarjetaGrafica>
          ))}

          <TarjetaGrafica
            titulo={`Contado y crédito mes a mes · ${datos.anio}`}
            descripcion="Barras: lo vendido de contado y a crédito. Línea: el dinero que entró (contado + abonos)."
            vacio={!datos.meses.some((m) => m.contado || m.credito || m.recaudo)}
            textoVacio="Aún no hay ventas en este año"
            className="xl:col-span-2"
          >
            <GraficaMensual meses={datos.meses} anio={datos.anio} />
          </TarjetaGrafica>
        </div>
      </section>

      <section aria-labelledby="dashboard-inventario" className="space-y-4">
        <h2 id="dashboard-inventario" className="text-2xl font-bold">
          Inventario · hoy
        </h2>
        <InventarioDashboard inventario={datos.inventario} onAgregarUnidades={puedeAgregarUnidades ? setReponiendo : undefined} />
      </section>

      {reponiendo && (
        <ModalAgregarUnidades
          producto={reponiendo}
          onCerrar={() => setReponiendo(null)}
          onListo={(mensaje) => {
            avisos.exito(mensaje);
            setReponiendo(null);
            consulta.recargar();
            avisarCambioNotificaciones();
          }}
        />
      )}
    </div>
  );
}
