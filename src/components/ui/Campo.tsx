/**
 * Campos de formulario accesibles.
 * - La etiqueta SIEMPRE está visible (no se usa solo el "placeholder").
 * - El error se anuncia a lectores de pantalla y se asocia al campo con aria-describedby.
 */
"use client";

import { useId, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { pesos } from "@/lib/formato";
import { Icono } from "./Icono";

const claseCampo =
  "block w-full min-h-12 rounded-xl border-2 bg-tarjeta px-4 py-2.5 text-lg text-texto placeholder:text-texto-tenue " +
  "focus:border-marca-700 focus:outline-none focus:ring-4 focus:ring-marca-200 disabled:bg-superficie-apagada";

interface Base {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  /** Marca el campo con un asterisco y "obligatorio" para lectores de pantalla */
  obligatorio?: boolean;
}

function Etiqueta({ htmlFor, texto, obligatorio }: { htmlFor: string; texto: string; obligatorio?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-lg font-bold text-texto">
      {texto}
      {obligatorio && (
        <span className="text-peligro-800" aria-hidden="true">
          {" "}
          *
        </span>
      )}
      {obligatorio && <span className="sr-only"> (obligatorio)</span>}
    </label>
  );
}

function Mensajes({ id, error, ayuda }: { id: string; error?: string; ayuda?: string }) {
  return (
    <>
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="mt-1 text-base text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-base font-bold text-peligro-800">
          <Icono nombre="alerta" className="mt-0.5 size-5" />
          {error}
        </p>
      )}
    </>
  );
}

const describedBy = (id: string, error?: string, ayuda?: string) =>
  error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;

/* --------------------------------- Texto --------------------------------- */

export function Campo({ etiqueta, error, ayuda, obligatorio, id, className = "", ...resto }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Etiqueta htmlFor={campoId} texto={etiqueta} obligatorio={obligatorio} />
      <input
        id={campoId}
        required={obligatorio}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(campoId, error, ayuda)}
        className={`${claseCampo} ${error ? "border-peligro-700" : "border-borde"}`}
        {...resto}
      />
      <Mensajes id={campoId} error={error} ayuda={ayuda} />
    </div>
  );
}

/* ---------------------------- Texto largo (área) --------------------------- */

export function AreaTexto({ etiqueta, error, ayuda, obligatorio, id, className = "", rows = 5, ...resto }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Etiqueta htmlFor={campoId} texto={etiqueta} obligatorio={obligatorio} />
      <textarea
        id={campoId}
        rows={rows}
        required={obligatorio}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(campoId, error, ayuda)}
        className={`${claseCampo} ${error ? "border-peligro-700" : "border-borde"} resize-y`}
        {...resto}
      />
      <Mensajes id={campoId} error={error} ayuda={ayuda} />
    </div>
  );
}

/* -------------------------------- Selector ------------------------------- */

export function Selector({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  id,
  className = "",
  children,
  ...resto
}: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Etiqueta htmlFor={campoId} texto={etiqueta} obligatorio={obligatorio} />
      {/*
        Sin la apariencia nativa: Chrome fuerza su propio alto de línea en <select> y el selector quedaba
        más bajo que los campos de texto vecinos. Así mide lo mismo que un <Campo> y la flecha es la del tema.
      */}
      <div className="relative">
        <select
          id={campoId}
          required={obligatorio}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(campoId, error, ayuda)}
          className={`${claseCampo} ${error ? "border-peligro-700" : "border-borde"} cursor-pointer appearance-none pr-12`}
          {...resto}
        >
          {children}
        </select>
        <Icono nombre="flechaAbajo" className="pointer-events-none absolute inset-y-0 right-4 my-auto size-6 text-texto-suave" />
      </div>
      <Mensajes id={campoId} error={error} ayuda={ayuda} />
    </div>
  );
}

/* ------------------------- Contraseña (ver/ocultar) ------------------------ */

export function CampoPassword(props: Base & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const campoId = props.id ?? autoId;
  const { etiqueta, error, ayuda, obligatorio, className = "", ...resto } = props;
  return (
    <div className={className}>
      <Etiqueta htmlFor={campoId} texto={etiqueta} obligatorio={obligatorio} />
      <div className="relative">
        <input
          {...resto}
          id={campoId}
          type={visible ? "text" : "password"}
          required={obligatorio}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(campoId, error, ayuda)}
          className={`${claseCampo} pr-28 ${error ? "border-peligro-700" : "border-borde"}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-1 right-1 flex items-center gap-1 rounded-lg px-3 text-base font-bold text-acento hover:bg-marca-50"
          aria-pressed={visible}
          aria-controls={campoId}
        >
          <Icono nombre={visible ? "ojoNo" : "ojo"} className="size-5" />
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
      <Mensajes id={campoId} error={error} ayuda={ayuda} />
    </div>
  );
}

/* --------------------------------- Dinero -------------------------------- */

/**
 * Campo de dinero: la persona escribe solo números y ve el valor con puntos de miles
 * ("150000" se muestra como "150.000"), lo que evita errores al leer cifras grandes.
 */
export function CampoDinero({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  valor,
  onCambio,
  className = "",
  id,
}: Base & { valor: number; onCambio: (v: number) => void; className?: string; id?: string }) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Etiqueta htmlFor={campoId} texto={etiqueta} obligatorio={obligatorio} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-bold text-texto-suave" aria-hidden="true">
          $
        </span>
        <input
          id={campoId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={valor ? valor.toLocaleString("es-CO") : ""}
          placeholder="0"
          onChange={(e) => onCambio(Number(e.target.value.replace(/\D/g, "").slice(0, 10)) || 0)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(campoId, error, ayuda)}
          className={`${claseCampo} pl-9 ${error ? "border-peligro-700" : "border-borde"}`}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        {valor ? pesos(valor) : ""}
      </span>
      <Mensajes id={campoId} error={error} ayuda={ayuda} />
    </div>
  );
}
