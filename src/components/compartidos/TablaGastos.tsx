/**
 * Lista de gastos con sus totales (la usan el vendedor y el administrador).
 * - Los gastos del negocio y los «Gastos personales» (de la dueña) se muestran en secciones separadas:
 *   los personales no se restan de la utilidad.
 * - Si se indica "onEliminar", cada gasto vigente muestra el botón rojo "Eliminar gasto".
 * - Un gasto eliminado (anulado) se ve con la insignia "Eliminado", el motivo, quién y cuándo,
 *   y sin botón de eliminar.
 * - ConfirmarAnulacionGasto: la ventana de confirmación con el motivo obligatorio.
 */
"use client";

import { useId, useState } from "react";
import { fechaDia, fechaHora, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { TEXTO_ESTADO_DEUDA } from "@/lib/deudas";
import { textoMedioPagoGasto } from "@/lib/pagos";
import { motivoAnulacionSchema } from "@/lib/validaciones";
import type { GastoFila, ListaGastos } from "@/tipos";
import { useAvisos } from "../ui/Avisos";
import { Insignia, Mensaje, Vacio } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Campo } from "../ui/Campo";
import { Confirmar, Modal } from "../ui/Modal";

export function TotalesGastos({ datos }: { datos: ListaGastos }) {
  const totales = [
    {
      titulo: "Gastos del negocio",
      valor: datos.total,
      // Los pagos de deudas suman aquí aunque no aparezcan en la lista (están en la pestaña «Deudas»)
      detalle: datos.totalPagosDeudas > 0 ? `Incluye pagos de deudas: ${pesos(datos.totalPagosDeudas)}` : "Se restan de la utilidad",
    },
    { titulo: "Pagado en efectivo", valor: datos.totalEfectivo, detalle: "Gastos del negocio" },
    { titulo: "Pagado por transferencia", valor: datos.totalTransferencia, detalle: "Gastos del negocio" },
    { titulo: "Gastos personales", valor: datos.totalPersonales, detalle: "Aparte: no se restan de la utilidad" },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {totales.map((t) => (
        <li key={t.titulo} className="rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm">
          <p className="text-lg font-bold text-texto-suave">{t.titulo}</p>
          <p className="mt-1 text-2xl font-bold text-acento sm:text-3xl">{pesos(t.valor)}</p>
          <p className="text-base text-texto-suave">{t.detalle}</p>
        </li>
      ))}
    </ul>
  );
}

export function TablaGastos({
  gastos,
  onEliminar,
  onVerDeuda,
  vacio = "Prueba con otro mes o categoría.",
}: {
  gastos: GastoFila[];
  onEliminar?: (gasto: GastoFila) => void;
  /** Si se indica, los gastos a crédito muestran el botón «Ver deuda» (solo el vendedor). */
  onVerDeuda?: (deudaId: string) => void;
  vacio?: string;
}) {
  if (gastos.length === 0) {
    return (
      <Vacio icono="dinero" titulo="No hay gastos para mostrar">
        {vacio}
      </Vacio>
    );
  }

  const delNegocio = gastos.filter((g) => !g.personal);
  const personales = gastos.filter((g) => g.personal);

  return (
    <div className="space-y-8">
      <SeccionGastos
        titulo="Gastos del negocio"
        vacio="No hay gastos del negocio en este periodo."
        gastos={delNegocio}
        onEliminar={onEliminar}
        onVerDeuda={onVerDeuda}
      />
      {personales.length > 0 && (
        <SeccionGastos
          titulo="Gastos personales"
          descripcion="Gastos propios de la dueña: se ven aparte y no se restan de la utilidad."
          gastos={personales}
          onEliminar={onEliminar}
          onVerDeuda={onVerDeuda}
        />
      )}
    </div>
  );
}

function SeccionGastos({
  titulo,
  descripcion,
  vacio,
  gastos,
  onEliminar,
  onVerDeuda,
}: {
  titulo: string;
  descripcion?: string;
  vacio?: string;
  gastos: GastoFila[];
  onEliminar?: (gasto: GastoFila) => void;
  onVerDeuda?: (deudaId: string) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-2xl font-bold">
        {titulo} <span className="text-lg font-normal text-texto-suave">({gastos.length})</span>
      </h3>
      {descripcion && <p className="mb-3 text-base text-texto-suave">{descripcion}</p>}
      {gastos.length === 0 ? (
        <p className="mt-2 text-lg text-texto-suave">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {gastos.map((g) => (
            <li
              key={g.id}
              className={`flex flex-col gap-3 rounded-2xl border-2 bg-tarjeta p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                g.anulado ? "border-peligro-700/50" : "border-linea"
              }`}
            >
              <div className="min-w-0">
                <h4 className="text-xl font-bold">{g.categoriaNombre}</h4>
                {g.descripcion && <p className="text-lg break-words">{g.descripcion}</p>}
                <p className="text-base text-texto-suave">
                  {fechaDia(g.fecha)} · Registrado por {g.usuarioNombre}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Insignia tono={g.medioPago === "EFECTIVO" ? "marca" : g.medioPago === "CREDITO" ? "neutro" : "info"}>
                    {textoMedioPagoGasto(g.medioPago)}
                  </Insignia>
                  {g.personal && <Insignia tono="alerta">Personal · no se resta</Insignia>}
                  {g.anulado && <Insignia tono="peligro">Eliminado</Insignia>}
                </div>
                {g.medioPago === "CREDITO" && (
                  // Un gasto a crédito no suma en los totales: el dinero sale con cada pago de la deuda
                  <p className="mt-2 text-base text-texto-suave">
                    Deuda con <strong className="text-texto">{g.deuda?.acreedor ?? "—"}</strong>: se paga en cuotas y no suma aquí (ver
                    Deudas).
                    {g.deuda && g.deuda.estado === "PENDIENTE" && ` Saldo: ${pesos(g.deuda.saldo)}.`}
                    {g.deuda && g.deuda.estado !== "PENDIENTE" && ` Deuda ${TEXTO_ESTADO_DEUDA[g.deuda.estado].toLowerCase()}.`}
                  </p>
                )}
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
                <p
                  className={`text-2xl font-bold ${g.anulado ? "text-texto-suave line-through" : g.medioPago === "CREDITO" ? "text-texto-suave" : "text-acento"}`}
                >
                  {pesos(g.valor)}
                  {g.medioPago === "CREDITO" && <span className="block text-base font-bold">a crédito</span>}
                </p>
                {onVerDeuda && g.deuda && (
                  <Boton variante="secundario" icono="dinero" onClick={() => onVerDeuda(g.deuda!.id)}>
                    Ver deuda
                  </Boton>
                )}
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
      )}
    </section>
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
  onVerDeuda,
}: {
  gasto: GastoFila | null;
  urlAnular: (id: string) => string;
  onCerrar: () => void;
  onAnulado: () => void;
  /** Si se indica, la ventana de "tiene pagos" ofrece ir directo a la deuda. */
  onVerDeuda?: (deudaId: string) => void;
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

  /*
   * Gasto a crédito con pagos vigentes: NO se puede eliminar todavía. Cada pago ya salió de la caja
   * de un día concreto, así que primero se anula cada pago (con su motivo) desde la pestaña «Deudas».
   */
  const deuda = gasto?.deuda;
  if (gasto && deuda && deuda.pagosVigentes > 0) {
    return (
      <Modal abierto onCerrar={cerrar} titulo="Primero anula los pagos">
        <div className="space-y-4 text-lg">
          <Mensaje tono="alerta" titulo={`Esta deuda tiene pagos por ${pesos(deuda.valorPagos)}`}>
            La deuda con {deuda.acreedor} tiene {deuda.pagosVigentes === 1 ? "1 pago" : `${deuda.pagosVigentes} pagos`}. Ese dinero ya salió de
            la caja.{" "}
            {onVerDeuda
              ? "Anula primero cada pago en la pestaña «Deudas» y después elimina el gasto."
              : // El administrador no maneja las deudas: las maneja el vendedor del local
                "El vendedor del local debe anular primero cada pago en Gastos → Deudas; después se puede eliminar el gasto."}
          </Mensaje>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={cerrar}>
              Cerrar
            </Boton>
            {onVerDeuda && (
              <Boton
                icono="dinero"
                onClick={() => {
                  cerrar();
                  onVerDeuda(deuda.id);
                }}
              >
                Ir a la deuda
              </Boton>
            )}
          </div>
        </div>
      </Modal>
    );
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
            <p>
              {gasto.medioPago === "CREDITO"
                ? "¿Seguro que quieres eliminar este gasto a crédito? Su deuda quedará anulada: ya no tendrá saldo por pagar ni avisos de pago."
                : "¿Seguro que quieres eliminar este gasto? Dejará de contar en los totales, pero quedará registrado."}
            </p>
            <dl className="grid gap-1 rounded-xl bg-superficie p-4">
              {[
                ["Categoría", gasto.categoriaNombre],
                ["Valor", pesos(gasto.valor)],
                ["Medio de pago", textoMedioPagoGasto(gasto.medioPago)],
                ...(gasto.deuda ? [["A quién se le debe", gasto.deuda.acreedor]] : []),
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
