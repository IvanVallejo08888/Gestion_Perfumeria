/**
 * Editor de cuotas del crédito.
 * 1. La persona elige cuántas cuotas, cada cuánto (semanal, quincenal o mensual) y la fecha del primer pago.
 * 2. Las fechas se llenan SOLAS y cada una se puede cambiar a gusto: hora, día, mes y año.
 * 3. El VALOR de cada cuota lo escribe la vendedora. Si activa "Distribuir automáticamente"
 *    (apagado de entrada), el total se reparte en partes iguales.
 * 4. Un resumen muestra cuánto se ha asignado y cuánto falta o sobra: las cuotas deben sumar el total.
 * Estas fechas se usan después como recordatorios de cobro en "Notificaciones".
 */
"use client";

import { useEffect, useId } from "react";
import { ajustarCantidadValores, repartirEnPartesIguales, resumirCuotas } from "@/lib/cuotas";
import { aInputFechaHora, fechaLarga, pesos } from "@/lib/formato";
import { Campo, CampoDinero, Selector } from "../ui/Campo";
import { Icono } from "../ui/Icono";

export type Frecuencia = "semanal" | "quincenal" | "mensual";

export interface ConfigCuotas {
  cantidad: number;
  frecuencia: Frecuencia;
  /** Fecha y hora del primer pago (formato de <input type="datetime-local">) */
  primera: string;
  /** Fecha y hora de cada cuota (editable) */
  fechas: string[];
  /** Valor de cada cuota en pesos (0 = sin escribir) */
  valores: number[];
  /** "Distribuir automáticamente": reparte el total en partes iguales */
  automatico: boolean;
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

/** Configuración inicial: 3 cuotas mensuales, la primera dentro de un mes a las 10:00 a. m., valores por escribir. */
export function configInicial(): ConfigCuotas {
  const primera = sumarPeriodo(new Date(), "mensual", 1);
  primera.setHours(10, 0, 0, 0);
  const valor = aInputFechaHora(primera);
  return {
    cantidad: 3,
    frecuencia: "mensual",
    primera: valor,
    fechas: calcularFechas(3, "mensual", valor),
    valores: [0, 0, 0],
    automatico: false,
  };
}

interface Props {
  config: ConfigCuotas;
  onCambio: (c: ConfigCuotas) => void;
  total: number;
  error?: string;
}

export function EditorCuotas({ config, onCambio, total, error }: Props) {
  const tituloId = useId();
  const ayudaSwitchId = useId();
  const { asignado, diferencia } = resumirCuotas(config.valores, total);
  const cuadra = total > 0 && diferencia === 0 && config.valores.every((v) => v > 0);
  const progreso = total > 0 ? Math.min(100, Math.round((asignado / total) * 100)) : 0;

  // En modo automático los valores siguen al total (si cambian los productos o el descuento)
  useEffect(() => {
    if (!config.automatico) return;
    const repartidos = repartirEnPartesIguales(total, config.cantidad);
    if (repartidos.some((v, i) => v !== config.valores[i])) onCambio({ ...config, valores: repartidos });
  }, [config, total, onCambio]);

  const regenerar = (cambios: Partial<ConfigCuotas>) => {
    const nueva = { ...config, ...cambios };
    onCambio({
      ...nueva,
      fechas: calcularFechas(nueva.cantidad, nueva.frecuencia, nueva.primera),
      valores: nueva.automatico
        ? repartirEnPartesIguales(total, nueva.cantidad)
        : ajustarCantidadValores(nueva.valores, nueva.cantidad),
    });
  };

  const cambiarAutomatico = () => {
    const automatico = !config.automatico;
    // Al apagarlo, los valores repartidos se quedan para que la vendedora los ajuste a mano
    onCambio({ ...config, automatico, valores: automatico ? repartirEnPartesIguales(total, config.cantidad) : config.valores });
  };

  const cambiarValor = (i: number, valor: number) => {
    const valores = [...config.valores];
    valores[i] = valor;
    onCambio({ ...config, valores });
  };

  /* Estado del resumen: siempre con ícono + texto, nunca solo color */
  const estado = cuadra
    ? { icono: "check" as const, texto: "Las cuotas cuadran con el total", clase: "border-exito-700 bg-exito-50 text-exito-800", barra: "bg-exito-700" }
    : diferencia < 0
      ? { icono: "alerta" as const, texto: `Sobran ${pesos(-diferencia)}: baja el valor de alguna cuota`, clase: "border-peligro-700 bg-peligro-50 text-peligro-800", barra: "bg-peligro-700" }
      : { icono: "info" as const, texto: diferencia > 0 ? `Faltan ${pesos(diferencia)} por asignar` : "Escribe el valor de cada cuota", clase: "border-alerta-700 bg-alerta-50 text-alerta-800", barra: "bg-marca-600" };

  return (
    <fieldset aria-labelledby={tituloId} className="min-w-0">
      <legend id={tituloId} className="mb-3 text-2xl font-bold">
        3. Cuotas del crédito
      </legend>

      <div className="grid gap-5 md:grid-cols-3">
        <Selector etiqueta="Número de cuotas" value={config.cantidad} onChange={(e) => regenerar({ cantidad: Number(e.target.value) })}>
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "cuota" : "cuotas"}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Cada cuánto paga" value={config.frecuencia} onChange={(e) => regenerar({ frecuencia: e.target.value as Frecuencia })}>
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

      {/* ------------------------- Resumen del reparto ------------------------- */}
      <section aria-label="Reparto del valor del crédito" className="mt-5 overflow-hidden rounded-2xl border-2 border-linea bg-superficie">
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <div>
            <p className="text-base font-bold text-texto-suave">Total del crédito</p>
            <p className="text-2xl font-bold">{pesos(total)}</p>
          </div>
          <div>
            <p className="text-base font-bold text-texto-suave">Asignado en cuotas</p>
            <p className="text-2xl font-bold">{pesos(asignado)}</p>
          </div>
          <div>
            <p className="text-base font-bold text-texto-suave">{diferencia < 0 ? "Sobra" : "Falta"}</p>
            <p className={`text-2xl font-bold ${diferencia < 0 ? "text-peligro-800" : diferencia > 0 ? "text-alerta-800" : "text-exito-800"}`}>
              {pesos(Math.abs(diferencia))}
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-5">
          <div
            role="progressbar"
            aria-label="Porcentaje del total asignado en cuotas"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progreso}
            className="h-3 w-full overflow-hidden rounded-full bg-superficie-apagada"
          >
            <div className={`h-full rounded-full transition-all duration-300 ${estado.barra}`} style={{ width: `${progreso}%` }} />
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <p aria-live="polite" className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-lg font-bold ${estado.clase}`}>
            <Icono nombre={estado.icono} />
            {estado.texto}
          </p>

          {/* Interruptor accesible: role="switch" + texto Sí/No visible */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={config.automatico}
              aria-describedby={ayudaSwitchId}
              onClick={cambiarAutomatico}
              className="group flex min-h-12 items-center gap-3 rounded-xl px-2 text-left text-lg font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
            >
              <span
                aria-hidden="true"
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors ${
                  config.automatico ? "border-marca-700 bg-marca-700" : "border-linea-fuerte bg-superficie-apagada"
                }`}
              >
                <span
                  className={`inline-block size-6 rounded-full bg-white shadow transition-transform duration-200 ${
                    config.automatico ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span>
                Distribuir automáticamente
                <span className="block text-base font-normal text-texto-suave">{config.automatico ? "Activado" : "Desactivado"}</span>
              </span>
            </button>
          </div>
        </div>
        <p id={ayudaSwitchId} className="border-t-2 border-linea bg-superficie-apagada px-4 py-3 text-base text-texto-suave sm:px-5">
          {config.automatico
            ? "El total se reparte en partes iguales (la última cuota ajusta los pesos sobrantes). Desactívalo para escribir cada valor."
            : "Escribe el valor de cada cuota. Las cuotas deben sumar exactamente el total del crédito."}
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-lg font-bold text-peligro-800">
          <Icono nombre="alerta" />
          {error}
        </p>
      )}

      {/* ------------------------------ Cuotas ------------------------------ */}
      <ol className="mt-4 space-y-3">
        {config.fechas.map((f, i) => {
          const valor = config.valores[i] ?? 0;
          return (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border-2 border-linea bg-superficie p-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,16rem)] md:items-start"
            >
              <div className="flex items-center gap-3 md:flex-col md:items-center md:gap-1 md:pt-8">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-marca-700 text-xl font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-lg font-bold md:text-base">Cuota {i + 1}</p>
              </div>
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
              {config.automatico ? (
                <div>
                  <p className="mb-2 text-lg font-bold">Valor de la cuota {i + 1}</p>
                  <p className="flex min-h-12 items-center rounded-xl border-2 border-dashed border-linea-fuerte bg-superficie-apagada px-4 text-xl font-bold">
                    {pesos(valor)}
                  </p>
                  <p className="mt-1 text-base text-texto-suave">Repartido automáticamente</p>
                </div>
              ) : (
                <CampoDinero
                  etiqueta={`Valor de la cuota ${i + 1}`}
                  valor={valor}
                  onCambio={(v) => cambiarValor(i, v)}
                  obligatorio
                  ayuda={valor > 0 ? undefined : "Escribe cuánto paga en esta cuota."}
                />
              )}
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
