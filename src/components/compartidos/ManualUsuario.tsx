/**
 * Manual de usuario dentro de Ajustes: un botón lo muestra u oculta y, adentro, una pestaña por sección.
 * Cada rol ve solo sus secciones (src/lib/manual.ts). Las tablas, en celular, se dibujan como tarjetas
 * «columna: valor» para no generar scroll horizontal; desde 640px se ven como tabla.
 */
"use client";

import { Fragment, useId, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Tarjeta } from "@/components/ui/Basicos";
import { Pestanas } from "@/components/ui/Pestanas";
import { seccionesPara, tramos, type BloqueManual, type RolManual } from "@/lib/manual";

export function ManualUsuario({ rol }: { rol: RolManual }) {
  const secciones = seccionesPara(rol);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(String(secciones[0].numero));
  const idContenido = useId();
  const seccion = secciones.find((s) => String(s.numero) === activa) ?? secciones[0];

  return (
    <div className="space-y-4">
      <Boton
        variante="secundario"
        icono="info"
        aria-expanded={abierto}
        aria-controls={idContenido}
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? "Ocultar manual de usuario" : "Ver manual de usuario"}
      </Boton>
      <div id={idContenido} hidden={!abierto}>
        <Pestanas
          etiqueta="Secciones del manual"
          pestanas={secciones.map((s) => ({ id: String(s.numero), titulo: `${s.numero}. ${s.titulo}` }))}
          activa={String(seccion.numero)}
          onCambio={setActiva}
        >
          <Tarjeta>
            <h3 className="mb-4 text-2xl font-bold text-texto">
              {seccion.numero}. {seccion.titulo}
            </h3>
            <div className="space-y-4 text-lg text-texto">
              {seccion.bloques.map((b, i) => (
                <Bloque key={i} bloque={b} />
              ))}
            </div>
          </Tarjeta>
        </Pestanas>
      </div>
    </div>
  );
}

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {tramos(texto).map((t, i) =>
        t.negrita ? (
          <strong key={i} className="font-bold">
            {t.texto}
          </strong>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        ),
      )}
    </>
  );
}

function Bloque({ bloque }: { bloque: BloqueManual }) {
  switch (bloque.tipo) {
    case "parrafo":
      return (
        <p className="break-words">
          <Texto texto={bloque.texto} />
        </p>
      );
    case "subtitulo":
      return (
        <h4 className="pt-2 text-xl font-bold text-acento">
          <Texto texto={bloque.texto} />
        </h4>
      );
    case "numerada":
    case "vinetas": {
      const Lista = bloque.tipo === "numerada" ? "ol" : "ul";
      return (
        <Lista className={`space-y-2 pl-7 ${bloque.tipo === "numerada" ? "list-decimal" : "list-disc"}`}>
          {bloque.items.map((item) => (
            <li key={item} className="break-words pl-1">
              <Texto texto={item} />
            </li>
          ))}
        </Lista>
      );
    }
    case "tabla":
      return <Tabla columnas={bloque.columnas} filas={bloque.filas} />;
  }
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <>
      {/* Celular: cada fila es una tarjeta con «columna: valor» */}
      <ul className="space-y-3 sm:hidden">
        {filas.map((fila) => (
          <li key={fila.join("|")} className="rounded-xl border-2 border-borde bg-superficie p-3">
            <dl className="space-y-2">
              {fila.map((celda, j) => (
                <div key={j}>
                  <dt className="text-base font-bold text-texto-suave">{columnas[j]}</dt>
                  <dd className="break-words">
                    <Texto texto={celda} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {/* Tablet y computador: tabla normal, con columnas que se reparten el ancho */}
      <table className="hidden w-full table-fixed border-collapse text-left text-lg sm:table">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="border-b-2 border-linea-fuerte bg-superficie px-3 py-2 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.join("|")} className="border-b border-linea align-top">
              {fila.map((celda, j) => (
                <td key={j} className="break-words px-3 py-2">
                  <Texto texto={celda} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
