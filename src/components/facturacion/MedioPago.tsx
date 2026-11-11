/**
 * Elección del medio de pago con botones grandes tipo radio.
 * Se usa en la factura, en los abonos (con Mixto) y en los gastos (sin Mixto).
 *
 * En Mixto la persona escribe la TRANSFERENCIA y el EFECTIVO se calcula solo.
 * El efectivo no se guarda en ningún estado: sale del total en cada dibujo,
 * así se actualiza al instante si cambian los productos, el descuento o el adicional.
 */
"use client";

import { useId } from "react";
import { calcularPago, MEDIOS_PAGO } from "@/lib/pagos";
import { pesos } from "@/lib/formato";
import type { MedioPago } from "@/tipos";
import { CampoDinero } from "../ui/Campo";
import { Icono } from "../ui/Icono";

interface BotonesProps<T extends string> {
  titulo: string;
  opciones: { valor: T; texto: string }[];
  valor: T | null;
  onCambio: (valor: T) => void;
  error?: string;
}

/** Radios nativos con apariencia de botón: funcionan con teclado y con lector de pantalla. */
export function BotonesMedioPago<T extends string>({ titulo, opciones, valor, onCambio, error }: BotonesProps<T>) {
  const nombre = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-lg font-bold">{titulo}</legend>
      <div className={`grid gap-3 ${opciones.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {opciones.map((o) => {
          const elegido = valor === o.valor;
          return (
            <label
              key={o.valor}
              className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-marca-600 ${
                elegido ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-tarjeta hover:border-marca-700 hover:bg-marca-50"
              }`}
            >
              <input type="radio" name={nombre} value={o.valor} checked={elegido} onChange={() => onCambio(o.valor)} className="sr-only" />
              {/* El estado también se indica con un ícono, no solo con el color */}
              {elegido && <Icono nombre="check" className="size-6" />}
              {o.texto}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-base font-bold text-peligro-800">
          <Icono nombre="alerta" className="mt-0.5 size-5" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface Props {
  titulo: string;
  /** Valor sobre el que se reparte el pago: total de la factura o valor del abono. */
  total: number;
  medio: MedioPago | null;
  onMedio: (medio: MedioPago) => void;
  transferencia: number;
  onTransferencia: (valor: number) => void;
  error?: string;
}

export function SelectorMedioPago({ titulo, total, medio, onMedio, transferencia, onTransferencia, error }: Props) {
  const reparto = calcularPago("MIXTO", total, transferencia);
  return (
    <div className="space-y-4">
      <BotonesMedioPago titulo={titulo} opciones={MEDIOS_PAGO} valor={medio} onCambio={onMedio} error={medio ? undefined : error} />
      {medio === "MIXTO" && (
        <div className="grid items-start gap-4 rounded-xl border-2 border-linea bg-superficie p-4 md:grid-cols-2">
          <CampoDinero
            etiqueta="Valor de la transferencia"
            valor={transferencia}
            onCambio={onTransferencia}
            ayuda={`Debe ser mayor que $ 0 y menor que ${pesos(total)}.`}
            error={transferencia > 0 ? (reparto.error ?? undefined) : error}
            obligatorio
          />
          <div aria-live="polite">
            <p className="text-lg font-bold">Efectivo a recibir</p>
            <p className="text-4xl font-bold text-acento">{pesos(Math.max(0, reparto.valorEfectivo))}</p>
            <p className="text-base text-texto-suave">Se calcula solo: total − transferencia.</p>
          </div>
        </div>
      )}
    </div>
  );
}
