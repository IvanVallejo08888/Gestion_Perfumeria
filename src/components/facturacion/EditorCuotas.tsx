/**
 * Editor de cuotas: lo usan el crédito de la factura (cobros a clientes) y el gasto a crédito (pagos de deudas).
 * 1. La persona elige cuántas cuotas, cada cuánto (semanal, quincenal o mensual) y la fecha del primer pago.
 * 2. Las fechas se llenan SOLAS.
 * 3. Cada fecha se puede cambiar a gusto: hora, día, mes y año.
 * Estas fechas se usan después como recordatorios en "Notificaciones".
 *
 * Opciones (las usa el gasto a crédito; la factura usa los valores por defecto y no cambia):
 *  - permitirPersonalizadas: frecuencia «Fechas personalizadas» (las fechas no se recalculan solas).
 *  - valores + onValores: el valor de cada cuota se puede editar (deben sumar el total).
 *  - avisarVencidas: muestra «Esta cuota ya está vencida» si la fecha ya pasó (deudas antiguas).
 */
"use client";

import { useId } from "react";
import { repartirEnCuotas } from "@/lib/deudas";
import { aInputFechaHora, fechaLarga, pesos } from "@/lib/formato";
import { Boton } from "../ui/Boton";
import { Campo, CampoDinero, Selector } from "../ui/Campo";

export type Frecuencia = "semanal" | "quincenal" | "mensual";
/** «personalizada»: la persona pone cada fecha a mano (solo en el gasto a crédito). */
export type FrecuenciaEditor = Frecuencia | "personalizada";

export interface ConfigCuotas<F extends FrecuenciaEditor = Frecuencia> {
  cantidad: number;
  frecuencia: F;
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

/**
 * Fechas personalizadas al cambiar la cantidad: se conservan las que ya están y las nuevas
 * se agregan un mes después de la última (luego se pueden cambiar a mano).
 */
function ajustarFechasPersonalizadas(fechas: string[], cantidad: number, primera: string): string[] {
  const lista = fechas.slice(0, cantidad);
  if (lista.length === 0 && cantidad > 0) lista.push(primera);
  while (lista.length < cantidad) lista.push(aInputFechaHora(sumarPeriodo(new Date(lista[lista.length - 1]), "mensual", 1)));
  return lista;
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
  return repartirEnCuotas(total, cantidad);
}

interface Props<F extends FrecuenciaEditor> {
  config: ConfigCuotas<F>;
  onCambio: (c: ConfigCuotas<F>) => void;
  total: number;
  error?: string;
  /** Título del grupo (por defecto, el de la factura). */
  titulo?: string;
  /** "cobro" (cuotas de un cliente) o "pago" (cuotas de una deuda). */
  accion?: "cobro" | "pago";
  permitirPersonalizadas?: boolean;
  /** Valores editables de cada cuota. Si no se envían, se reparten en partes iguales y no se editan. */
  valores?: number[];
  onValores?: (valores: number[]) => void;
  avisarVencidas?: boolean;
}

export function EditorCuotas<F extends FrecuenciaEditor = Frecuencia>({
  config,
  onCambio,
  total,
  error,
  titulo = "3. Cuotas del crédito",
  accion = "cobro",
  permitirPersonalizadas = false,
  valores: valoresEditables,
  onValores,
  avisarVencidas = false,
}: Props<F>) {
  const tituloId = useId();
  const editables = !!valoresEditables && !!onValores;
  const valores = editables ? valoresEditables : valoresCuotas(total, config.cantidad);
  const suma = valores.reduce((a, v) => a + v, 0);
  const ahora = Date.now();

  const regenerar = (cambios: Partial<ConfigCuotas<F>>) => {
    const nueva = { ...config, ...cambios };
    const fechas =
      nueva.frecuencia === "personalizada"
        ? ajustarFechasPersonalizadas(cambios.primera ? [cambios.primera, ...config.fechas.slice(1)] : config.fechas, nueva.cantidad, nueva.primera)
        : calcularFechas(nueva.cantidad, nueva.frecuencia as Frecuencia, nueva.primera);
    onCambio({ ...nueva, fechas });
    // Si cambia la cantidad, los valores se vuelven a repartir en partes iguales
    if (editables && cambios.cantidad !== undefined && cambios.cantidad !== config.cantidad) onValores!(repartirEnCuotas(total, nueva.cantidad));
  };

  return (
    <fieldset aria-labelledby={tituloId} className="min-w-0">
      <legend id={tituloId} className="mb-3 text-2xl font-bold">
        {titulo}
      </legend>

      <div className="grid gap-5 md:grid-cols-3">
        <Selector
          etiqueta="Número de cuotas"
          value={config.cantidad}
          onChange={(e) => regenerar({ cantidad: Number(e.target.value) } as Partial<ConfigCuotas<F>>)}
        >
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "cuota" : "cuotas"}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta={accion === "cobro" ? "Cada cuánto paga" : "Cada cuánto pagas"}
          value={config.frecuencia}
          onChange={(e) => regenerar({ frecuencia: e.target.value as F } as Partial<ConfigCuotas<F>>)}
        >
          <option value="semanal">Cada semana</option>
          <option value="quincenal">Cada 15 días</option>
          <option value="mensual">Cada mes</option>
          {permitirPersonalizadas && <option value="personalizada">Fechas personalizadas</option>}
        </Selector>
        <Campo
          etiqueta="Fecha y hora del primer pago"
          type="datetime-local"
          value={config.primera}
          onChange={(e) => e.target.value && regenerar({ primera: e.target.value } as Partial<ConfigCuotas<F>>)}
        />
      </div>
      <p className="mt-2 text-base text-texto-suave">
        {config.frecuencia === "personalizada"
          ? "Fechas personalizadas: escribe la fecha y hora de cada cuota abajo."
          : "Las fechas se calculan solas. Si cambias los datos de arriba, se vuelven a calcular. Puedes ajustar cada fecha abajo."}
        {editables && " El valor de cada cuota se reparte en partes iguales; puedes cambiarlo, pero la suma debe ser igual al total."}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-lg font-bold text-peligro-800">
          {error}
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {config.fechas.map((f, i) => {
          const vencida = avisarVencidas && f !== "" && new Date(f).getTime() < ahora;
          return (
            <li
              key={i}
              className={`grid grid-cols-[minmax(0,1fr)] items-end gap-3 rounded-xl border-2 bg-superficie p-4 md:grid-cols-[8rem_minmax(0,1fr)_12rem] ${
                vencida ? "border-alerta-700" : "border-linea"
              }`}
            >
              <p className="text-lg font-bold">Cuota {i + 1}</p>
              <div>
                <Campo
                  etiqueta={`Fecha y hora de ${accion} de la cuota ${i + 1}`}
                  type="datetime-local"
                  value={f}
                  onChange={(e) => {
                    const fechas = [...config.fechas];
                    fechas[i] = e.target.value;
                    onCambio({ ...config, fechas });
                  }}
                  ayuda={f ? fechaLarga(new Date(f)) : undefined}
                />
                {vencida && (
                  <p className="mt-1 text-base font-bold text-alerta-800" role="status">
                    ⚠ Esta cuota ya está vencida
                  </p>
                )}
              </div>
              {editables ? (
                <CampoDinero
                  etiqueta={`Valor de la cuota ${i + 1}`}
                  valor={valores[i] ?? 0}
                  onCambio={(v) => {
                    const nuevos = [...valores];
                    nuevos[i] = v;
                    onValores!(nuevos);
                  }}
                />
              ) : (
                <div className="md:text-right">
                  <p className="text-base font-bold text-texto-suave">Valor</p>
                  <p className="text-xl font-bold">{pesos(valores[i] ?? 0)}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editables && (
        <div
          aria-live="polite"
          className={`mt-4 flex flex-col gap-3 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
            suma === total ? "border-exito-700 bg-exito-50" : "border-peligro-700 bg-peligro-50"
          }`}
        >
          <p className="text-lg font-bold">
            {suma === total
              ? `✓ Las cuotas suman ${pesos(suma)}: igual al total.`
              : `✗ Las cuotas suman ${pesos(suma)} y el total es ${pesos(total)} (${suma < total ? "faltan" : "sobran"} ${pesos(Math.abs(total - suma))}).`}
          </p>
          {suma !== total && (
            <Boton variante="secundario" onClick={() => onValores!(repartirEnCuotas(total, config.cantidad))}>
              Repartir en partes iguales
            </Boton>
          )}
        </div>
      )}
    </fieldset>
  );
}
