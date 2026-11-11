/**
 * Gráficas del dashboard (Recharts).
 *
 *  - BarrasHorizontales: una fila por categoría. El nombre va ARRIBA de la barra (a todo el ancho,
 *    así se lee igual en celular) y el valor escrito en la punta: nada depende solo del color
 *    ni de pasar el mouse.
 *  - GraficaMensual: contado + crédito apilados y el recaudo como línea, en un solo eje ($).
 *
 * Accesibilidad: cada gráfica trae sus datos en una tabla (oculta para lectores de pantalla en
 * las barras; desplegable en la mensual). La letra dentro de las gráficas es fija (16px).
 * Colores validados para daltonismo; las tres series se distinguen además por forma y leyenda.
 */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  useChartWidth,
  XAxis,
  YAxis,
  type LabelProps,
} from "recharts";
import { pesosCorto } from "@/lib/dashboard";
import { anioMesColombia, pesos } from "@/lib/formato";
import type { MesDashboard } from "@/tipos";

/** Colores de las gráficas: Black Cherry (marca-800) del tema + dos tonos que se distinguen con daltonismo. */
export const COLOR = {
  principal: "#530309",
  /** "Otras" y "Sin categoría": no son una categoría real, van en gris. */
  tenue: "#8c7a6e",
  contado: "#530309",
  credito: "#0891b2",
  recaudo: "#c2410c",
  tinta: "#231a16",
  tintaSuave: "#4a3a32",
  rejilla: "#e8e2da",
} as const;

/* ------------------------------ Tarjeta con título ------------------------------ */

export function TarjetaGrafica({
  titulo,
  descripcion,
  acciones,
  vacio,
  textoVacio = "Aún no hay ventas en este periodo",
  className = "",
  children,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  /** Sin datos: en vez de la gráfica se muestra el mensaje. */
  vacio: boolean;
  textoVacio?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`relative flex min-w-0 flex-col rounded-2xl border-2 border-linea bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h3 className="text-xl font-bold">{titulo}</h3>
      {descripcion && <p className="text-base text-texto-suave">{descripcion}</p>}
      {acciones && <div className="mt-3">{acciones}</div>}
      {vacio ? (
        <p className="mt-4 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-linea-fuerte px-4 py-10 text-center text-lg text-texto-suave">
          {textoVacio}
        </p>
      ) : (
        <div className="mt-4 min-w-0">{children}</div>
      )}
    </section>
  );
}

/* ------------------------------- Ventana de detalle ------------------------------- */

function CajaDetalle({ titulo, lineas }: { titulo: string; lineas: [string, string][] }) {
  return (
    <div className="max-w-64 rounded-xl border-2 border-linea-fuerte bg-white px-3 py-2 text-[16px] shadow-lg">
      <p className="font-bold break-words">{titulo}</p>
      {lineas.map(([etiqueta, valor]) => (
        <p key={etiqueta} className="flex justify-between gap-4">
          <span className="text-texto-suave">{etiqueta}</span>
          <span className="font-bold whitespace-nowrap">{valor}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------ Barras horizontales ------------------------------ */

export interface FilaBarra {
  clave: string;
  etiqueta: string;
  /** Número que define el largo de la barra. */
  valor: number;
  /** El mismo valor escrito, en la punta de la barra ("$ 1.680.000" o "37"). */
  textoValor: string;
  /** Dato de apoyo a la derecha del nombre ("4 unidades"). */
  secundario?: string;
  /** Todas las medidas de la fila: para la ventana de detalle y la tabla. */
  detalle: [string, string][];
  /** Categoría que no es real ("Otras", "Sin categoría"): barra gris. */
  tenue?: boolean;
}

const ALTO_BARRA = 16;
/** Alto de cada fila: nombre + barra. En pantallas angostas el dato de apoyo baja a otra línea. */
const ALTO_FILA = { ancha: 58, angosta: 78 } as const;
const ANCHO_ANGOSTO = 420;

/**
 * Nombre de la categoría arriba de su barra, a todo el ancho (se recorta con "…" solo si no cabe).
 * Con espacio, el dato de apoyo va a la derecha del nombre; en celular va debajo, para no recortar el nombre.
 */
function EtiquetaFila({ y, value, filas, dosLineas }: LabelProps & { filas: FilaBarra[]; dosLineas: boolean }) {
  const ancho = useChartWidth();
  // Se busca por clave y no por posición: Recharts no numera las barras que no dibuja
  const fila = filas.find((f) => f.clave === value);
  if (!fila || !ancho) return null;
  const alto = dosLineas ? 46 : 26;
  return (
    <foreignObject x={0} y={Number(y) - alto - 4} width={ancho} height={alto}>
      <div className={`text-[16px] text-texto ${dosLineas ? "leading-[23px]" : "flex items-baseline justify-between gap-3 leading-[26px]"}`}>
        <span className="block truncate font-bold">{fila.etiqueta}</span>
        {fila.secundario && <span className="block shrink-0 text-[15px] text-texto-suave">{fila.secundario}</span>}
      </div>
    </foreignObject>
  );
}

export function BarrasHorizontales({ filas, titulo, columna }: { filas: FilaBarra[]; titulo: string; columna: string }) {
  // Ancho real de la gráfica: decide si el dato de apoyo cabe junto al nombre o baja a otra línea
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!caja.current) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.round(entrada.contentRect.width)));
    observador.observe(caja.current);
    return () => observador.disconnect();
  }, []);
  const dosLineas = ancho > 0 && ancho < ANCHO_ANGOSTO && filas.some((f) => f.secundario);
  const altoFila = dosLineas ? ALTO_FILA.angosta : ALTO_FILA.ancha;
  // El nombre de la primera fila se dibuja por encima de su franja
  const margenSuperior = dosLineas ? 22 : 12;
  // Espacio a la derecha para el valor escrito en la punta de la barra más larga
  const margenDerecho = Math.max(...filas.map((f) => f.textoValor.length)) * 9 + 14;
  const medidas = filas[0]?.detalle.map(([etiqueta]) => etiqueta) ?? [];

  return (
    <>
      <div aria-hidden="true" ref={caja}>
        <ResponsiveContainer width="100%" height={filas.length * altoFila + margenSuperior}>
          <BarChart
            data={filas}
            layout="vertical"
            margin={{ top: margenSuperior, right: margenDerecho, bottom: 0, left: 0 }}
            barSize={ALTO_BARRA}
            accessibilityLayer={false}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="clave" hide />
            <Tooltip
              cursor={{ fill: "rgba(17, 24, 39, 0.05)" }}
              content={({ active, payload }) => {
                const fila = active ? (payload?.[0]?.payload as FilaBarra | undefined) : undefined;
                return fila ? <CajaDetalle titulo={fila.etiqueta} lineas={fila.detalle} /> : null;
              }}
            />
            {/* minPointSize: las categorías en cero conservan su fila (nombre y valor "0") */}
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} minPointSize={2} isAnimationActive={false}>
              {filas.map((f) => (
                <Cell key={f.clave} fill={f.tenue ? COLOR.tenue : COLOR.principal} />
              ))}
              <LabelList dataKey="clave" content={(p) => <EtiquetaFila {...p} filas={filas} dosLineas={dosLineas} />} />
              <LabelList dataKey="textoValor" position="right" offset={8} fill={COLOR.tinta} fontSize={16} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Los mismos datos para lectores de pantalla. Va dentro de un <div>: una <table> ignora
          el ancho de 1px de "sr-only" y haría aparecer scroll horizontal en la página. */}
      <div className="sr-only">
      <table>
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{columna}</th>
            {medidas.map((m) => (
              <th key={m} scope="col">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <th scope="row">{f.etiqueta}</th>
              {f.detalle.map(([m, v]) => (
                <td key={m}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

/* ------------------------ Contado vs crédito mes a mes + recaudo ------------------------ */

function Leyenda() {
  const claseItem = "inline-flex items-center gap-2 text-[16px] text-texto";
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
      <li className={claseItem}>
        <span className="size-4 rounded-sm" style={{ background: COLOR.contado }} />
        Contado
      </li>
      <li className={claseItem}>
        <span className="size-4 rounded-sm" style={{ background: COLOR.credito }} />
        Crédito
      </li>
      <li className={claseItem}>
        <span className="relative h-0.5 w-6" style={{ background: COLOR.recaudo }}>
          <span className="absolute top-1/2 left-1/2 size-2.5 -translate-1/2 rounded-full" style={{ background: COLOR.recaudo }} />
        </span>
        Recaudo (contado + abonos)
      </li>
    </ul>
  );
}

export function GraficaMensual({ meses, anio }: { meses: MesDashboard[]; anio: number }) {
  // Los meses que aún no llegan no tienen recaudo: la línea se corta ahí en vez de caer a cero
  const { anio: anioHoy, mes: mesHoy } = anioMesColombia(new Date());
  const esFuturo = (mes: number) => anio > anioHoy || (anio === anioHoy && mes > mesHoy);
  const datos = meses.map((m) => ({ ...m, corto: m.nombre.slice(0, 3), recaudo: esFuturo(m.mes) ? null : m.recaudo }));
  const ejes = { fontSize: 14, fill: COLOR.tintaSuave };

  return (
    <>
      <Leyenda />
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={COLOR.rejilla} />
            <XAxis dataKey="corto" tickLine={false} axisLine={{ stroke: "#d1d5db" }} tick={ejes} />
            <YAxis tickFormatter={pesosCorto} width={74} tickLine={false} axisLine={false} tick={ejes} />
            <Tooltip
              cursor={{ fill: "rgba(17, 24, 39, 0.05)" }}
              content={({ active, payload }) => {
                const corto = active ? (payload?.[0]?.payload as { mes: number } | undefined) : undefined;
                const m = corto && meses.find((x) => x.mes === corto.mes);
                return m ? (
                  <CajaDetalle
                    titulo={`${m.nombre} ${anio}`}
                    lineas={[
                      ["Contado", pesos(m.contado)],
                      ["Crédito", pesos(m.credito)],
                      ["Total vendido", pesos(m.contado + m.credito)],
                      ["Recaudo", pesos(m.recaudo)],
                    ]}
                  />
                ) : null;
              }}
            />
            {/* El borde blanco separa los dos tramos apilados */}
            <Bar dataKey="contado" stackId="ventas" fill={COLOR.contado} maxBarSize={24} stroke="#ffffff" strokeWidth={2} isAnimationActive={false} />
            <Bar dataKey="credito" stackId="ventas" fill={COLOR.credito} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="#ffffff" strokeWidth={2} isAnimationActive={false} />
            <Line
              dataKey="recaudo"
              type="linear"
              stroke={COLOR.recaudo}
              strokeWidth={2}
              dot={{ r: 4, fill: COLOR.recaudo, stroke: "#ffffff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLOR.recaudo, stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3">
        <summary className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border-2 border-marca-700 px-4 py-2 text-lg font-bold text-marca-800 hover:bg-marca-50">
          Ver los valores en una tabla
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[16px]">
            <caption className="sr-only">Contado, crédito y recaudo por mes del año {anio}</caption>
            <thead>
              <tr className="border-b-2 border-linea-fuerte">
                <th scope="col" className="py-2 pr-3">Mes</th>
                <th scope="col" className="py-2 pr-3 text-right">Contado</th>
                <th scope="col" className="py-2 pr-3 text-right">Crédito</th>
                <th scope="col" className="py-2 pr-3 text-right">Total vendido</th>
                <th scope="col" className="py-2 text-right">Recaudo</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b border-linea">
                  <th scope="row" className="py-2 pr-3">{m.nombre}</th>
                  <td className="py-2 pr-3 text-right">{pesos(m.contado)}</td>
                  <td className="py-2 pr-3 text-right">{pesos(m.credito)}</td>
                  <td className="py-2 pr-3 text-right">{pesos(m.contado + m.credito)}</td>
                  <td className="py-2 text-right">{pesos(m.recaudo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
