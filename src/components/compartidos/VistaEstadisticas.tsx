/**
 * Vista de estadísticas de un local para un año (la usan el administrador y el vendedor).
 * - Tarjetas con los totales del año.
 * - Gráfico de barras por mes (cada barra muestra su valor escrito, no solo la altura).
 * - Tabla por mes y productos más vendidos.
 * Si se indica "mes", ese mes se resalta y se muestra su detalle.
 */
"use client";

import { pesos } from "@/lib/formato";
import type { Estadisticas } from "@/tipos";
import { Tarjeta } from "../ui/Basicos";

export function VistaEstadisticas({ datos, mes }: { datos: Estadisticas; mes?: number }) {
  const mesDatos = mes ? datos.meses[mes - 1] : null;
  const base = mesDatos ?? datos.totales;
  const maximo = Math.max(1, ...datos.meses.map((m) => m.totalVentas));
  const periodo = mesDatos ? `${mesDatos.nombre} ${datos.anio}` : `año ${datos.anio}`;

  const resumen = [
    { titulo: "Total vendido", valor: pesos(base.totalVentas), detalle: `Contado + crédito · ${periodo}` },
    { titulo: "Dinero recibido", valor: pesos(base.totalRecaudado), detalle: "Contado + abonos recibidos" },
    { titulo: "Ventas de contado", valor: pesos(base.ventasContado), detalle: `${base.cantidadContado} facturas` },
    { titulo: "Créditos otorgados", valor: pesos(base.ventasCredito), detalle: `${base.cantidadCredito} créditos` },
    { titulo: "Abonos recibidos", valor: pesos(base.recaudoAbonos), detalle: "Pagos a créditos" },
    {
      titulo: "Por cobrar hoy",
      valor: pesos(datos.creditosPendientes.saldo),
      detalle: `${datos.creditosPendientes.cantidad} créditos pendientes`,
    },
  ];

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resumen.map((r) => (
          <li key={r.titulo} className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-texto-suave">{r.titulo}</p>
            <p className="mt-1 text-3xl font-bold text-marca-800">{r.valor}</p>
            <p className="mt-1 text-base text-texto-suave">{r.detalle}</p>
          </li>
        ))}
      </ul>

      <Tarjeta>
        <h2 className="text-2xl font-bold">Ventas por mes · {datos.anio}</h2>
        <p className="text-base text-texto-suave">Cada barra muestra el total vendido del mes.</p>
        {/* Gráfico de barras horizontal: se lee bien en celular y en computador */}
        <ul className="mt-4 space-y-2" aria-label="Ventas por mes">
          {datos.meses.map((m) => (
            <li key={m.mes} className={`grid grid-cols-[6.5rem_1fr] items-center gap-3 rounded-lg px-1 ${m.mes === mes ? "bg-marca-50 py-1" : ""}`}>
              <span className={`text-base ${m.mes === mes ? "font-bold" : ""}`}>{m.nombre}</span>
              <div className="flex items-center gap-2">
                <div
                  className={`h-7 rounded-md ${m.mes === mes ? "bg-marca-800" : "bg-marca-600"}`}
                  style={{ width: `${Math.max(m.totalVentas ? 2 : 0, (m.totalVentas / maximo) * 75)}%` }}
                  aria-hidden="true"
                />
                <span className="text-base font-bold whitespace-nowrap">{pesos(m.totalVentas)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-2xl font-bold">Detalle mensual</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-base">
            <caption className="sr-only">Detalle de ventas por mes del año {datos.anio}</caption>
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th scope="col" className="py-2 pr-3">Mes</th>
                <th scope="col" className="py-2 pr-3 text-right">Contado</th>
                <th scope="col" className="py-2 pr-3 text-right">Créditos</th>
                <th scope="col" className="py-2 pr-3 text-right">Abonos</th>
                <th scope="col" className="py-2 pr-3 text-right">Total vendido</th>
                <th scope="col" className="py-2 text-right">Recibido</th>
              </tr>
            </thead>
            <tbody>
              {datos.meses.map((m) => (
                <tr key={m.mes} className={`border-b border-gray-200 ${m.mes === mes ? "bg-marca-50 font-bold" : ""}`}>
                  <th scope="row" className="py-2 pr-3">{m.nombre}</th>
                  <td className="py-2 pr-3 text-right">{pesos(m.ventasContado)}</td>
                  <td className="py-2 pr-3 text-right">{pesos(m.ventasCredito)}</td>
                  <td className="py-2 pr-3 text-right">{pesos(m.recaudoAbonos)}</td>
                  <td className="py-2 pr-3 text-right">{pesos(m.totalVentas)}</td>
                  <td className="py-2 text-right">{pesos(m.totalRecaudado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-400 font-bold">
                <th scope="row" className="py-2 pr-3">Total</th>
                <td className="py-2 pr-3 text-right">{pesos(datos.totales.ventasContado)}</td>
                <td className="py-2 pr-3 text-right">{pesos(datos.totales.ventasCredito)}</td>
                <td className="py-2 pr-3 text-right">{pesos(datos.totales.recaudoAbonos)}</td>
                <td className="py-2 pr-3 text-right">{pesos(datos.totales.totalVentas)}</td>
                <td className="py-2 text-right">{pesos(datos.totales.totalRecaudado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-2xl font-bold">Productos más vendidos · {datos.anio}</h2>
        {datos.topProductos.length === 0 ? (
          <p className="text-lg text-texto-suave">Aún no hay ventas este año.</p>
        ) : (
          <ol className="space-y-2">
            {datos.topProductos.map((p, i) => (
              <li key={p.nombre} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 text-lg">
                <span>
                  <span className="mr-2 font-bold text-marca-700">{i + 1}.</span>
                  {p.nombre}
                </span>
                <span className="font-bold">
                  {p.cantidad} und. · {pesos(p.total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>
    </div>
  );
}
