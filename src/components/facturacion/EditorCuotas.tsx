/**
 * Editor de cuotas del crédito.
 * 1. La persona elige cuántas cuotas, cada cuánto (semanal, quincenal o mensual) y la fecha del primer pago.
 * 2. Las fechas se llenan SOLAS.
 * 3. Cada fecha se puede cambiar a gusto: hora, día, mes y año.
 * Estas fechas se usan después como recordatorios de cobro en "Notificaciones".
 */
"use client";

import { useId } from "react";
import { aInputFechaHora, fechaLarga, pesos } from "@/lib/formato";
import { Campo, Selector } from "../ui/Campo";

export type Frecuencia = "semanal" | "quincenal" | "mensual";

export interface ConfigCuotas {
  cantidad: number;
  frecuencia: Frecuencia;
  /** Fecha y hora del primer pago (formato de <input type="datetime-local">) */
  primera: string;
  /** Fecha y hora de cada cuota (editable) */
  fechas: string[];
}

/** Suma periodos a una fecha (el mensual respeta el fin de mes: 31 ene → 28/29 feb). */
function sumarPeriodo(base: Date, frecuencia: Frecuencia, veces: number): Date {
  const d = new Date(base);
  if (frecuencia === "semanal") d.setDate(d.getDate() + 7 * veces);
  else if (frecuencia === "quincenal") d.setDate(d.getDate() + 15 * veces);
  else {
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + veces);
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimoDia));
  }
  return d;
}

export function calcularFechas(cantidad: number, frecuencia: Frecuencia, primera: string): string[] {
  const inicio = new Date(primera);
  if (Number.isNaN(inicio.getTime())) return [];
  return Array.from({ length: cantidad }, (_, i) => aInputFechaHora(sumarPeriodo(inicio, frecuencia, i)));
}

/** Configuración inicial: 3 cuotas mensuales, la primera dentro de un mes a las 10:00 a. m. */
export function configInicial(): ConfigCuotas {
  const primera = sumarPeriodo(new Date(), "mensual", 1);
  primera.setHours(10, 0, 0, 0);
  const valor = aInputFechaHora(primera);
  return { cantidad: 3, frecuencia: "mensual", primera: valor, fechas: calcularFechas(3, "mensual", valor) };
}

/** Valor de cada cuota (iguales; la última ajusta la diferencia de redondeo). */
export function valoresCuotas(total: number, cantidad: number): number[] {
  if (cantidad <= 0) return [];
  const base = Math.floor(total / cantidad);
  return Array.from({ length: cantidad }, (_, i) => (i === cantidad - 1 ? total - base * (cantidad - 1) : base));
}

interface Props {
  config: ConfigCuotas;
  onCambio: (c: ConfigCuotas) => void;
  total: number;
  error?: string;
}

export function EditorCuotas({ config, onCambio, total, error }: Props) {
  const tituloId = useId();
  const valores = valoresCuotas(total, config.cantidad);

  const regenerar = (cambios: Partial<ConfigCuotas>) => {
    const nueva = { ...config, ...cambios };
    onCambio({ ...nueva, fechas: calcularFechas(nueva.cantidad, nueva.frecuencia, nueva.primera) });
  };

  return (
    <fieldset aria-labelledby={tituloId}>
      <legend id={tituloId} className="mb-3 text-2xl font-bold">
        3. Cuotas del crédito
      </legend>

      <div className="grid gap-5 md:grid-cols-3">
        <Selector
          etiqueta="Número de cuotas"
          value={config.cantidad}
          onChange={(e) => regenerar({ cantidad: Number(e.target.value) })}
        >
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "cuota" : "cuotas"}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Cada cuánto paga"
          value={config.frecuencia}
          onChange={(e) => regenerar({ frecuencia: e.target.value as Frecuencia })}
        >
          <option value="semanal">Cada semana</option>
          <option value="quincenal">Cada 15 días</option>
          <option value="mensual">Cada mes</option>
        </Selector>
        <Campo
          etiqueta="Fecha y hora del primer pago"
          type="datetime-local"
          value={config.primera}
          onChange={(e) => e.target.value && regenerar({ primera: e.target.value })}
        />
      </div>
      <p className="mt-2 text-base text-texto-suave">
        Las fechas se calculan solas. Si cambias los datos de arriba, se vuelven a calcular. Puedes ajustar cada fecha abajo.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-lg font-bold text-peligro-700">
          {error}
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {config.fechas.map((f, i) => (
          <li key={i} className="grid items-end gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 md:grid-cols-[8rem_1fr_10rem]">
            <p className="text-lg font-bold">Cuota {i + 1}</p>
            <Campo
              etiqueta={`Fecha y hora de cobro de la cuota ${i + 1}`}
              type="datetime-local"
              value={f}
              onChange={(e) => {
                const fechas = [...config.fechas];
                fechas[i] = e.target.value;
                onCambio({ ...config, fechas });
              }}
              ayuda={f ? fechaLarga(new Date(f)) : undefined}
            />
            <div className="md:text-right">
              <p className="text-base font-bold text-texto-suave">Valor</p>
              <p className="text-xl font-bold">{pesos(valores[i] ?? 0)}</p>
            </div>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
