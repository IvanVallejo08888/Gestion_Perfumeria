/**
 * Lista de verificación en vivo de los requisitos de la contraseña.
 * Cada requisito muestra ✔ o ✖ junto al texto (no depende solo del color).
 */
"use client";

import { REGLAS_PASSWORD } from "@/lib/validaciones";
import { Icono } from "./Icono";

export function ReglasPassword({ valor, confirmacion }: { valor: string; confirmacion?: string }) {
  const reglas = [
    ...REGLAS_PASSWORD.map((r) => ({ id: r.id, texto: r.texto, cumple: r.prueba(valor) })),
    ...(confirmacion !== undefined
      ? [{ id: "coinciden", texto: "Las dos contraseñas coinciden", cumple: valor.length > 0 && valor === confirmacion }]
      : []),
  ];

  return (
    <div className="rounded-xl border-2 border-linea bg-superficie p-4">
      <p className="mb-2 text-lg font-bold" id="requisitos-password">
        Tu contraseña debe tener:
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2" aria-labelledby="requisitos-password">
        {reglas.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 text-base font-bold ${r.cumple ? "text-exito-700" : "text-texto-suave"}`}>
            <span
              className={`flex size-6 items-center justify-center rounded-full border-2 ${r.cumple ? "border-exito-700 bg-exito-700 text-white" : "border-borde"}`}
              aria-hidden="true"
            >
              {r.cumple ? <Icono nombre="check" className="size-4" /> : null}
            </span>
            {r.texto}
            <span className="sr-only">{r.cumple ? ": cumplido" : ": pendiente"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
