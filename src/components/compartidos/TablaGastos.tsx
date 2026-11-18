/**
 * Lista de gastos con sus totales (la usan el vendedor y el administrador).
 * - Si se indica "onEliminar", cada gasto vigente muestra el botón rojo "Eliminar gasto".
 * - Un gasto eliminado (anulado) se ve con la insignia "Eliminado", el motivo, quién y cuándo,
 *   y sin botón de eliminar.
 * - ConfirmarAnulacionGasto: la ventana de confirmación con el motivo obligatorio.
 */
"use client";

import { useState } from "react";
import { fechaDia, fechaHora, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { textoMedioPago } from "@/lib/pagos";
import { motivoAnulacionSchema } from "@/lib/validaciones";
import type { GastoFila, ListaGastos } from "@/tipos";
import { useAvisos } from "../ui/Avisos";
import { Insignia, Vacio } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Campo } from "../ui/Campo";
import { Confirmar } from "../ui/Modal";

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

export function TablaGastos({
  gastos,
  onEliminar,
  vacio = "Prueba con otro mes o categoría.",
}: {
  gastos: GastoFila[];
  onEliminar?: (gasto: GastoFila) => void;
  vacio?: string;
}) {
  if (gastos.length === 0) {
    return (
      <Vacio icono="dinero" titulo="No hay gastos para mostrar">
        {vacio}
      </Vacio>
    );
  }

  return (
    <ul className="space-y-3">
      {gastos.map((g) => (
        <li
          key={g.id}
          className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            g.anulado ? "border-peligro-700/50" : "border-gray-200"
          }`}
        >
          <div className="min-w-0">
            <h3 className="text-xl font-bold">{g.categoriaNombre}</h3>
            {g.descripcion && <p className="text-lg break-words">{g.descripcion}</p>}
            <p className="text-base text-texto-suave">
              {fechaDia(g.fecha)} · Registrado por {g.usuarioNombre}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Insignia tono={g.medioPago === "EFECTIVO" ? "marca" : "info"}>{textoMedioPago(g.medioPago)}</Insignia>
              {g.anulado && <Insignia tono="peligro">Eliminado</Insignia>}
            </div>
            {g.anulado && (
              <div className="mt-2 rounded-xl bg-peligro-50 px-3 py-2 text-base text-peligro-800">
                <p className="break-words">
                  <strong>Motivo:</strong> {g.motivoAnulacion}
                </p>
                <p>
                  Eliminado por {g.anuladoPorNombre ?? "—"}
                  {g.anuladoEn ? ` el ${fechaHora(g.anuladoEn)}` : ""}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end">
            <p className={`text-2xl font-bold ${g.anulado ? "text-texto-suave line-through" : "text-marca-800"}`}>{pesos(g.valor)}</p>
            {onEliminar && !g.anulado && (
              <Boton
                variante="peligro"
                icono="basura"
                onClick={() => onEliminar(g)}
                aria-label={`Eliminar gasto de ${g.categoriaNombre} por ${pesos(g.valor)}`}
              >
                Eliminar gasto
              </Boton>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Confirmación de "Eliminar gasto" con motivo obligatorio.
 * urlAnular: endpoint a usar (el del vendedor o el del administrador).
 */
export function ConfirmarAnulacionGasto({
  gasto,
  urlAnular,
  onCerrar,
  onAnulado,
}: {
  gasto: GastoFila | null;
  urlAnular: (id: string) => string;
  onCerrar: () => void;
  onAnulado: () => void;
}) {
  const avisos = useAvisos();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    if (enviando) return;
    setMotivo("");
    setError("");
    onCerrar();
  }

  async function confirmar() {
    if (!gasto) return;
    const validacion = motivoAnulacionSchema.safeParse({ motivo });
    if (!validacion.success) return setError(validacion.error.issues[0].message);
    setError("");
    setEnviando(true);
    try {
      await api(urlAnular(gasto.id), { method: "POST", json: validacion.data });
      avisos.exito("Gasto eliminado.");
      setMotivo("");
      onAnulado();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Confirmar
      abierto={gasto !== null}
      titulo="Eliminar gasto"
      textoConfirmar="Sí, eliminar gasto"
      peligro
      cargando={enviando}
      onConfirmar={confirmar}
      onCerrar={cerrar}
      mensaje={
        gasto && (
          <div className="space-y-4">
            <p>¿Seguro que quieres eliminar este gasto? Dejará de contar en los totales, pero quedará registrado.</p>
            <dl className="grid gap-1 rounded-xl bg-gray-50 p-4">
              {[
                ["Categoría", gasto.categoriaNombre],
                ["Valor", pesos(gasto.valor)],
                ["Medio de pago", textoMedioPago(gasto.medioPago)],
                ["Fecha", fechaDia(gasto.fecha)],
                ["Descripción", gasto.descripcion || "—"],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="break-words">
                  <dt className="inline font-bold">{etiqueta}: </dt>
                  <dd className="inline">{valor}</dd>
                </div>
              ))}
            </dl>
            <Campo
              etiqueta="Motivo de la eliminación"
              obligatorio
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              error={error}
              ayuda="Entre 5 y 200 caracteres. Ejemplo: Se registró dos veces."
            />
          </div>
        )
      }
    />
  );
}
