/**
 * Lista de gastos con sus totales (la usan el vendedor y el administrador).
 * Si se indica "onEliminar", los gastos que se pueden eliminar muestran el botón.
 */
"use client";

import { fechaDia, pesos } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import type { GastoFila, ListaGastos } from "@/tipos";
import { Insignia, Vacio } from "../ui/Basicos";
import { Boton } from "../ui/Boton";

export function TotalesGastos({ datos }: { datos: ListaGastos }) {
  const totales = [
    { titulo: "Total de gastos", valor: datos.total },
    { titulo: "Pagado en efectivo", valor: datos.totalEfectivo },
    { titulo: "Pagado por transferencia", valor: datos.totalTransferencia },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {totales.map((t) => (
        <li key={t.titulo} className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-lg font-bold text-texto-suave">{t.titulo}</p>
          <p className="mt-1 text-2xl font-bold text-marca-800 sm:text-3xl">{pesos(t.valor)}</p>
        </li>
      ))}
    </ul>
  );
}

export function TablaGastos({ gastos, onEliminar }: { gastos: GastoFila[]; onEliminar?: (gasto: GastoFila) => void }) {
  if (gastos.length === 0) {
    return (
      <Vacio icono="dinero" titulo="No hay gastos para mostrar">
        Prueba con otro mes o categoría.
      </Vacio>
    );
  }

  return (
    <ul className="space-y-3">
      {gastos.map((g) => (
        <li key={g.id} className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-xl font-bold">{g.categoriaNombre}</h3>
            {g.descripcion && <p className="text-lg break-words">{g.descripcion}</p>}
            <p className="text-base text-texto-suave">
              {fechaDia(g.fecha)} · Registrado por {g.usuarioNombre}
            </p>
            <div className="mt-2">
              <Insignia tono={g.medioPago === "EFECTIVO" ? "marca" : "info"}>{textoMedioPago(g.medioPago)}</Insignia>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
            <p className="text-2xl font-bold text-marca-800">{pesos(g.valor)}</p>
            {onEliminar && g.puedeEliminar && (
              <Boton pequeno variante="secundario" icono="basura" onClick={() => onEliminar(g)}>
                Eliminar
              </Boton>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
