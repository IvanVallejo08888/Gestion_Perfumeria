/**
 * Indicadores principales del dashboard, en tarjetas (de 2 en 2 en celular, 3 en escritorio).
 * Ventas → periodo elegido · Inventario, cartera y agotados → hoy.
 */
import { pesos } from "@/lib/formato";
import type { Dashboard } from "@/tipos";

interface Kpi {
  titulo: string;
  valor: string;
  detalle: string;
  /** Resalta el valor en rojo (y el detalle lo explica con texto). */
  alerta?: boolean;
}

export function TarjetasKpi({ kpis, periodo }: { kpis: Dashboard["kpis"]; periodo: string }) {
  const unidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const lista: Kpi[] = [
    { titulo: "Total vendido", valor: pesos(kpis.totalVendido), detalle: `Contado + crédito · ${periodo}` },
    { titulo: "Recaudado", valor: pesos(kpis.recaudado), detalle: `Contado + abonos · ${periodo}` },
    { titulo: "Unidades vendidas", valor: String(kpis.unidadesVendidas), detalle: `Perfumes vendidos · ${periodo}` },
    { titulo: "Valor del inventario hoy", valor: pesos(kpis.valorInventario), detalle: "Stock actual a precio de venta" },
    {
      titulo: "Cartera pendiente",
      valor: pesos(kpis.carteraPendiente),
      detalle: `${unidad(kpis.creditosPendientes, "crédito", "créditos")} por cobrar hoy`,
    },
    {
      titulo: "Perfumes agotados",
      valor: String(kpis.perfumesAgotados),
      detalle: kpis.perfumesAgotados ? "Sin unidades: no se pueden vender" : "Todos tienen unidades",
      alerta: kpis.perfumesAgotados > 0,
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      {lista.map((k) => (
        <li key={k.titulo} className="flex min-w-0 flex-col rounded-2xl border-2 border-gray-200 bg-white p-2.5 shadow-sm sm:p-5">
          <p className="text-base font-bold text-texto-suave sm:text-lg">{k.titulo}</p>
          {/* En celular el valor es más pequeño para que quepan cifras de millones en media pantalla */}
          <p className={`mt-1 text-lg font-bold break-words sm:text-2xl ${k.alerta ? "text-peligro-700" : "text-marca-800"}`}>{k.valor}</p>
          <p className="mt-1 text-[15px] text-texto-suave sm:text-base">{k.detalle}</p>
        </li>
      ))}
    </ul>
  );
}
