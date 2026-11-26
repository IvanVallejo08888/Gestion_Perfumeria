/**
 * Ventanas de una deuda (gasto a crédito):
 *  - VentanaPagar: valor (con atajos «Pagar cuota N» y «Pagar todo»), medio de pago (Mixto: se escribe la
 *    transferencia y el efectivo se calcula solo), fecha (hoy u otra, para un pago olvidado) y nota.
 *    El pago sale de la caja del día del pago. Si el saldo llega a 0 muestra «¡Deuda con … pagada por completo!».
 *  - VentanaDetalle: cuotas, todos los pagos (también los anulados) y el cierre de la deuda pagada.
 *    Cada pago vigente se puede anular con un motivo (se revierte en cuotas y saldo).
 *  - VentanaFechas: cambiar la fecha y hora de las cuotas pendientes.
 *  - CierreDeuda: «Pagada completamente el …» + forma de pago + lista de todos los pagos.
 */
"use client";

import { useState, type FormEvent } from "react";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { useConsulta } from "@/hooks/useConsulta";
import { calcularPago, textoMedioPago } from "@/lib/pagos";
import { estaVencida, textoFormaPagoFinal, TEXTO_ESTADO_DEUDA, validarPagoDeuda } from "@/lib/deudas";
import { aInputFechaHora, fechaDia, fechaHora, fechaLarga, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { motivoAnulacionSchema } from "@/lib/validaciones";
import type { DeudaDetalle, DeudaPagoFila, MedioPago } from "@/tipos";
import { SelectorMedioPago } from "../facturacion/MedioPago";
import { useAvisos } from "../ui/Avisos";
import { Cargando, Insignia, Mensaje } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Campo, CampoDinero } from "../ui/Campo";
import { GrupoOpciones } from "../ui/GrupoOpciones";
import { Icono } from "../ui/Icono";
import { Confirmar, Modal } from "../ui/Modal";

/** Carga el detalle de una deuda (null = ventana cerrada). */
function useDeuda(deudaId: string | null) {
  const avisos = useAvisos();
  return useConsulta<{ deuda: DeudaDetalle }>(deudaId ? `/api/deudas/${deudaId}` : null, { alError: avisos.error });
}

/* ================================ Pagar ================================ */

const OPCIONES_FECHA = [
  { valor: "hoy", texto: "Hoy, ahora" },
  { valor: "otra", texto: "Otra fecha (pago olvidado)" },
] as const;

export function VentanaPagar({ deudaId, onCerrar, onPagado }: { deudaId: string | null; onCerrar: () => void; onPagado: () => void }) {
  const consulta = useDeuda(deudaId);
  const deuda = consulta.urlDatos === `/api/deudas/${deudaId}` ? consulta.datos?.deuda : null;
  // Cuando la deuda queda pagada se muestra el cierre en la misma ventana
  const [pagada, setPagada] = useState<DeudaDetalle | null>(null);

  function cerrar() {
    setPagada(null);
    onCerrar();
  }

  return (
    <Modal abierto={deudaId !== null} onCerrar={cerrar} titulo={pagada ? "Deuda pagada" : `Pagar deuda${deuda ? ` con ${deuda.acreedor}` : ""}`} tamano="lg">
      {pagada ? (
        <div className="space-y-5">
          <div role="status" className="rounded-2xl border-2 border-exito-700 bg-exito-50 p-5 text-center">
            <Icono nombre="check" className="mx-auto size-14 text-exito-700" />
            <p className="mt-2 text-3xl font-bold text-exito-800">¡Deuda con {pagada.acreedor} pagada por completo!</p>
          </div>
          <CierreDeuda deuda={pagada} />
          <Boton ancho onClick={cerrar}>
            Listo
          </Boton>
        </div>
      ) : !deuda ? (
        consulta.error ? <Mensaje tono="peligro">{consulta.error}</Mensaje> : <Cargando />
      ) : deuda.estado !== "PENDIENTE" ? (
        <Mensaje tono="info">Esta deuda está {TEXTO_ESTADO_DEUDA[deuda.estado].toLowerCase()}: no tiene saldo por pagar.</Mensaje>
      ) : (
        <FormularioPago
          key={deuda.id + deuda.saldo}
          deuda={deuda}
          onCancelar={cerrar}
          onGuardado={(nueva, quedoPagada) => {
            avisarCambioNotificaciones();
            onPagado();
            if (quedoPagada) setPagada(nueva);
            else cerrar();
          }}
        />
      )}
    </Modal>
  );
}

function FormularioPago({
  deuda,
  onCancelar,
  onGuardado,
}: {
  deuda: DeudaDetalle;
  onCancelar: () => void;
  onGuardado: (deuda: DeudaDetalle, quedoPagada: boolean) => void;
}) {
  const avisos = useAvisos();
  const proxima = deuda.proximaCuota;
  const [valor, setValor] = useState(proxima?.pendiente ?? deuda.saldo);
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [transferencia, setTransferencia] = useState(0);
  const [cuando, setCuando] = useState<"hoy" | "otra">("hoy");
  const [fechaOtra, setFechaOtra] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return aInputFechaHora(d);
  });
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral("");
    const nuevos: Record<string, string> = {};
    const errorValor = validarPagoDeuda(deuda.saldo, valor);
    if (errorValor) nuevos.valor = errorValor;
    if (!medio) nuevos.medio = "Elige cómo pagaste.";
    else if (medio === "MIXTO") {
      const reparto = calcularPago("MIXTO", valor, transferencia);
      if (reparto.error) nuevos.medio = reparto.error;
    }
    const fechaPago = cuando === "otra" ? new Date(fechaOtra) : null;
    if (fechaPago && (Number.isNaN(fechaPago.getTime()) || fechaPago.getTime() > Date.now())) nuevos.fecha = "Elige una fecha y hora que ya hayan pasado.";
    if (Object.keys(nuevos).length) return setErrores(nuevos);
    setErrores({});
    setGuardando(true);
    try {
      const respuesta = await api<{ deuda: DeudaDetalle; quedoPagada: boolean }>(`/api/deudas/${deuda.id}/pagos`, {
        method: "POST",
        json: {
          valor,
          medioPago: medio,
          ...(medio === "MIXTO" ? { valorTransferencia: transferencia } : {}),
          ...(fechaPago ? { fecha: fechaPago.toISOString() } : {}),
          nota: nota.trim() || undefined,
        },
      });
      if (!respuesta.quedoPagada) avisos.exito(`Pago de ${pesos(valor)} registrado. Queda un saldo de ${pesos(respuesta.deuda.saldo)}.`);
      onGuardado(respuesta.deuda, respuesta.quedoPagada);
    } catch (err) {
      setErrorGeneral((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      {errorGeneral && <Mensaje tono="peligro">{errorGeneral}</Mensaje>}
      <dl className="grid gap-2 rounded-xl bg-superficie p-4 text-lg sm:grid-cols-3">
        <div>
          <dt className="font-bold text-texto-suave">Total</dt>
          <dd className="text-xl font-bold">{pesos(deuda.valorTotal)}</dd>
        </div>
        <div>
          <dt className="font-bold text-texto-suave">Pagado</dt>
          <dd className="text-xl font-bold">{pesos(deuda.pagado)}</dd>
        </div>
        <div>
          <dt className="font-bold text-texto-suave">Saldo</dt>
          <dd className="text-xl font-bold text-acento">{pesos(deuda.saldo)}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <CampoDinero etiqueta="Valor a pagar" valor={valor} onCambio={setValor} error={errores.valor} obligatorio />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {proxima && proxima.pendiente < deuda.saldo && (
            <Boton variante="secundario" onClick={() => setValor(proxima.pendiente)}>
              Pagar cuota {proxima.numero} ({pesos(proxima.pendiente)})
            </Boton>
          )}
          <Boton variante="secundario" onClick={() => setValor(deuda.saldo)}>
            Pagar todo ({pesos(deuda.saldo)})
          </Boton>
        </div>
      </div>

      <SelectorMedioPago
        titulo="¿Cómo pagaste?"
        total={valor}
        medio={medio}
        onMedio={setMedio}
        transferencia={transferencia}
        onTransferencia={setTransferencia}
        error={errores.medio}
      />

      <div className="space-y-3">
        <p className="text-lg font-bold" aria-hidden="true">
          Fecha del pago
        </p>
        <GrupoOpciones etiqueta="Fecha del pago" opciones={OPCIONES_FECHA} valor={cuando} onCambio={setCuando} />
        {cuando === "otra" && (
          <Campo
            etiqueta="Fecha y hora del pago"
            type="datetime-local"
            max={aInputFechaHora(new Date())}
            value={fechaOtra}
            onChange={(e) => setFechaOtra(e.target.value)}
            error={errores.fecha}
            ayuda={fechaOtra ? `${fechaLarga(new Date(fechaOtra))}. Se descuenta de la caja de ese día.` : undefined}
            obligatorio
          />
        )}
        {cuando === "hoy" && <p className="text-base text-texto-suave">El pago se descuenta de la caja de hoy.</p>}
      </div>

      <Campo etiqueta="Nota (opcional)" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="exito" icono="check" cargando={guardando}>
          Registrar pago de {pesos(valor)}
        </Boton>
      </div>
    </form>
  );
}

/* ============================ Cierre de la deuda ============================ */

/** Resumen de una deuda pagada: fecha, forma de pago final y la lista de TODOS los pagos. */
export function CierreDeuda({ deuda, onAnular }: { deuda: DeudaDetalle; onAnular?: (p: DeudaPagoFila) => void }) {
  const vigentes = deuda.pagos.filter((p) => !p.anulado);
  return (
    <section aria-label="Cierre de la deuda" className="space-y-3 rounded-2xl border-2 border-exito-700 bg-tarjeta p-4">
      <p className="text-xl font-bold">
        <Icono nombre="check" className="mr-1 inline size-6 text-exito-700" />
        Pagada completamente el {deuda.pagadaEn ? fechaHora(deuda.pagadaEn) : "—"}
      </p>
      {deuda.resumenMedioPago && (
        <div className="text-lg">
          <p>
            Forma de pago: <strong>{textoFormaPagoFinal(deuda.resumenMedioPago)}</strong>
          </p>
          {deuda.resumenMedioPago === "MIXTO" && (
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              <li>
                En efectivo: <strong>{pesos(deuda.totalEfectivo)}</strong>
              </li>
              <li>
                Por transferencia: <strong>{pesos(deuda.totalTransferencia)}</strong>
              </li>
            </ul>
          )}
        </div>
      )}
      {onAnular && <p className="text-base text-texto-suave">¿Un pago se registró por error? Anúlalo: la deuda vuelve a quedar pendiente con ese saldo.</p>}
      <ListaPagos pagos={vigentes} onAnular={onAnular} />
    </section>
  );
}

function ListaPagos({ pagos, onAnular }: { pagos: DeudaPagoFila[]; onAnular?: (p: DeudaPagoFila) => void }) {
  if (pagos.length === 0) return <p className="text-lg text-texto-suave">Todavía no hay pagos.</p>;
  return (
    <ol className="space-y-2">
      {pagos.map((p, i) => (
        <li key={p.id} className={`rounded-xl border-2 p-3 ${p.anulado ? "border-peligro-700/50 bg-peligro-50" : "border-linea bg-superficie"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-lg">
              <p className="font-bold">
                Pago {i + 1} · {fechaHora(p.fecha)}
              </p>
              <p className={p.anulado ? "line-through" : ""}>
                <strong>{pesos(p.valor)}</strong> · {textoMedioPago(p.medioPago)}
                {p.medioPago === "MIXTO" && ` (efectivo ${pesos(p.valorEfectivo)} + transferencia ${pesos(p.valorTransferencia)})`}
              </p>
              <p className="text-base text-texto-suave">Registrado por {p.usuarioNombre}</p>
              {p.nota && <p className="text-base break-words">Nota: {p.nota}</p>}
              {p.anulado && (
                <p className="mt-1 text-base text-peligro-800">
                  <Insignia tono="peligro">Anulado</Insignia> {p.motivoAnulacion} · {p.anuladoPorNombre ?? "—"}
                  {p.anuladoEn ? ` el ${fechaHora(p.anuladoEn)}` : ""}
                </p>
              )}
            </div>
            {onAnular && !p.anulado && (
              <Boton variante="peligro" icono="basura" onClick={() => onAnular(p)} aria-label={`Anular el pago de ${pesos(p.valor)} del ${fechaHora(p.fecha)}`}>
                Anular pago
              </Boton>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ======================== Ver cuotas y pagos (detalle) ======================== */

export function VentanaDetalle({
  deudaId,
  onCerrar,
  onCambio,
  onPagar,
}: {
  deudaId: string | null;
  onCerrar: () => void;
  /** Se llama después de anular un pago (para recargar la lista y los totales). */
  onCambio: () => void;
  onPagar: (id: string) => void;
}) {
  const avisos = useAvisos();
  const consulta = useDeuda(deudaId);
  const deuda = consulta.urlDatos === `/api/deudas/${deudaId}` ? consulta.datos?.deuda : null;
  const [anulando, setAnulando] = useState<DeudaPagoFila | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    if (!anulando) return;
    const validacion = motivoAnulacionSchema.safeParse({ motivo });
    if (!validacion.success) return setErrorMotivo(validacion.error.issues[0].message);
    setEnviando(true);
    try {
      await api(`/api/deudas/pagos/${anulando.id}/anular`, { method: "POST", json: validacion.data });
      avisos.exito(`Pago de ${pesos(anulando.valor)} anulado. El saldo de la deuda se recalculó.`);
      setAnulando(null);
      setMotivo("");
      setErrorMotivo("");
      avisarCambioNotificaciones();
      onCambio();
      await consulta.recargar();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Modal abierto={deudaId !== null && !anulando} onCerrar={onCerrar} titulo={deuda ? `Deuda con ${deuda.acreedor}` : "Deuda"} tamano="xl">
        {!deuda ? (
          consulta.error ? <Mensaje tono="peligro">{consulta.error}</Mensaje> : <Cargando />
        ) : (
          <div className="space-y-6">
            <div className="text-lg">
              <p>
                <Insignia tono={deuda.estado === "PAGADA" ? "exito" : deuda.estado === "ANULADA" ? "peligro" : "alerta"}>
                  {TEXTO_ESTADO_DEUDA[deuda.estado]}
                </Insignia>{" "}
                {deuda.categoriaNombre} · adquirida el {fechaDia(deuda.fecha)} · registrada por {deuda.creadoPorNombre}
              </p>
              {deuda.descripcion && <p className="mt-1 break-words">{deuda.descripcion}</p>}
              <p className="mt-1">
                Total <strong>{pesos(deuda.valorTotal)}</strong> · Pagado <strong>{pesos(deuda.pagado)}</strong> · Saldo{" "}
                <strong>{pesos(deuda.saldo)}</strong>
              </p>
            </div>

            {deuda.estado === "PAGADA" && <CierreDeuda deuda={deuda} onAnular={setAnulando} />}
            {deuda.estado === "ANULADA" && (
              <Mensaje tono="peligro" titulo="Deuda anulada">
                Se eliminó su gasto de origen{deuda.anuladaEn ? ` el ${fechaHora(deuda.anuladaEn)}` : ""}
                {deuda.anuladaPorNombre ? ` (${deuda.anuladaPorNombre})` : ""}. Motivo: {deuda.motivoAnulacion ?? "—"}
              </Mensaje>
            )}

            <section aria-labelledby="titulo-cuotas-deuda">
              <h3 id="titulo-cuotas-deuda" className="mb-2 text-2xl font-bold">
                Cuotas ({deuda.cuotasPagadas} de {deuda.totalCuotas} pagadas)
              </h3>
              <ol className="space-y-2">
                {deuda.cuotas.map((c) => {
                  const vencida = deuda.estado === "PENDIENTE" && c.estado === "PENDIENTE" && estaVencida(new Date(c.fechaVencimiento));
                  return (
                    <li
                      key={c.id}
                      className={`flex flex-col gap-1 rounded-xl border-2 p-3 text-lg sm:flex-row sm:items-center sm:justify-between ${
                        vencida ? "border-peligro-700" : "border-linea"
                      }`}
                    >
                      <span>
                        <strong>Cuota {c.numero}</strong> · {fechaHora(c.fechaVencimiento)}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <strong>{pesos(c.valor)}</strong>
                        {c.estado === "PAGADA" ? (
                          <Insignia tono="exito">Pagada</Insignia>
                        ) : vencida ? (
                          <Insignia tono="peligro">Vencida</Insignia>
                        ) : (
                          <Insignia tono="alerta">Pendiente</Insignia>
                        )}
                        {c.estado === "PENDIENTE" && c.valorPagado > 0 && <span className="text-base">(abonado {pesos(c.valorPagado)})</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            {deuda.estado !== "PAGADA" && (
              <section aria-labelledby="titulo-pagos-deuda">
                <h3 id="titulo-pagos-deuda" className="mb-2 text-2xl font-bold">
                  Pagos
                </h3>
                <ListaPagos pagos={deuda.pagos} onAnular={deuda.estado === "PENDIENTE" ? setAnulando : undefined} />
              </section>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Boton variante="secundario" onClick={onCerrar}>
                Cerrar
              </Boton>
              {deuda.estado === "PENDIENTE" && (
                <Boton variante="exito" icono="dinero" onClick={() => onPagar(deuda.id)}>
                  Pagar
                </Boton>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Confirmar
        abierto={anulando !== null}
        titulo="Anular pago"
        textoConfirmar="Sí, anular pago"
        peligro
        cargando={enviando}
        onConfirmar={anular}
        onCerrar={() => {
          if (enviando) return;
          setAnulando(null);
          setMotivo("");
          setErrorMotivo("");
        }}
        mensaje={
          anulando && (
            <div className="space-y-4">
              <p>
                Se anulará el pago de <strong>{pesos(anulando.valor)}</strong> del {fechaHora(anulando.fecha)}. Dejará de contar en la caja de ese
                día y en los gastos, y el saldo de la deuda subirá {pesos(anulando.valor)}.
              </p>
              <Campo
                etiqueta="Motivo"
                obligatorio
                maxLength={200}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                error={errorMotivo}
                ayuda="Entre 5 y 200 caracteres. Ejemplo: Se registró dos veces."
              />
            </div>
          )
        }
      />
    </>
  );
}

/* ============================== Editar fechas ============================== */

export function VentanaFechas({ deudaId, onCerrar, onCambio }: { deudaId: string | null; onCerrar: () => void; onCambio: () => void }) {
  const avisos = useAvisos();
  const consulta = useDeuda(deudaId);
  const deuda = consulta.urlDatos === `/api/deudas/${deudaId}` ? consulta.datos?.deuda : null;
  const [editadas, setEditadas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  function cerrar() {
    setEditadas({});
    onCerrar();
  }

  async function guardar(cuotaId: string) {
    const valor = editadas[cuotaId];
    const fecha = new Date(valor);
    if (!valor || Number.isNaN(fecha.getTime())) return avisos.error("Escribe una fecha y hora válidas.");
    setGuardando(cuotaId);
    try {
      await api(`/api/deudas/cuotas/${cuotaId}`, { method: "PUT", json: { fechaVencimiento: fecha.toISOString() } });
      avisos.exito(`Fecha cambiada: ${fechaHora(fecha)}.`);
      setEditadas(({ [cuotaId]: _, ...resto }) => resto);
      avisarCambioNotificaciones();
      onCambio();
      await consulta.recargar();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setGuardando(null);
    }
  }

  const pendientes = deuda?.cuotas.filter((c) => c.estado === "PENDIENTE") ?? [];

  return (
    <Modal abierto={deudaId !== null} onCerrar={cerrar} titulo={deuda ? `Fechas de pago · ${deuda.acreedor}` : "Fechas de pago"} tamano="lg">
      {!deuda ? (
        consulta.error ? <Mensaje tono="peligro">{consulta.error}</Mensaje> : <Cargando />
      ) : pendientes.length === 0 ? (
        <Mensaje tono="info">Esta deuda no tiene cuotas pendientes.</Mensaje>
      ) : (
        <div className="space-y-4">
          <p className="text-lg">Solo se pueden cambiar las cuotas pendientes. Las nuevas fechas se usan en los recordatorios de pago.</p>
          <ol className="space-y-3">
            {pendientes.map((c) => {
              const valor = editadas[c.id] ?? aInputFechaHora(new Date(c.fechaVencimiento));
              const cambiada = editadas[c.id] !== undefined;
              return (
                <li key={c.id} className="grid gap-3 rounded-xl border-2 border-linea bg-superficie p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Campo
                    etiqueta={`Cuota ${c.numero} · ${pesos(c.valor - c.valorPagado)}`}
                    type="datetime-local"
                    value={valor}
                    onChange={(e) => setEditadas({ ...editadas, [c.id]: e.target.value })}
                    ayuda={valor ? fechaLarga(new Date(valor)) : undefined}
                  />
                  <Boton icono="calendario" disabled={!cambiada} cargando={guardando === c.id} onClick={() => guardar(c.id)}>
                    Guardar fecha
                  </Boton>
                </li>
              );
            })}
          </ol>
          <div className="flex justify-end">
            <Boton variante="secundario" onClick={cerrar}>
              Cerrar
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
