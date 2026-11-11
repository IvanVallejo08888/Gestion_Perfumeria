/**
 * Historial de créditos.
 * - Buscar por IDENTIFICACIÓN del cliente.
 * - Abonar al crédito (se aplica a las cuotas en orden).
 * - Cuando el saldo llega a 0: pasa de "Pendiente" a "Completado" y aparece en el historial de ventas completadas.
 * - Ver y cambiar las fechas de cobro de las cuotas pendientes.
 */
"use client";

import { useState, type FormEvent } from "react";
import { DetalleFactura } from "@/components/facturacion/DetalleFactura";
import { SelectorMedioPago } from "@/components/facturacion/MedioPago";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Modal } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { aInputFechaHora, fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { calcularPago, textoMedioPago } from "@/lib/pagos";
import type { FacturaDetalle, MedioPago } from "@/tipos";

interface Credito {
  id: string;
  numero: number;
  estado: "PENDIENTE" | "COMPLETADA";
  clienteNombre: string;
  clienteIdentificacion: string;
  clienteTelefono: string;
  total: number;
  saldo: number;
  creadoEn: string;
  completadaEn: string | null;
  totalCuotas: number;
  cuotasPagadas: number;
  proximaCuota: string | null;
}

export function GestionCreditos({ identificacionInicial }: { identificacionInicial: string }) {
  const avisos = useAvisos();
  const [identificacion, setIdentificacion] = useState(identificacionInicial);
  const [buscada, setBuscada] = useState(identificacionInicial);
  const [abonando, setAbonando] = useState<string | null>(null);
  const [cuotasDe, setCuotasDe] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const consulta = useConsulta<{ creditos: Credito[] }>(
    `/api/creditos${buscada ? `?identificacion=${encodeURIComponent(buscada)}` : ""}`,
    { alError: avisos.error },
  );
  const creditos = consulta.cargando ? null : (consulta.datos?.creditos ?? (consulta.error ? [] : null));
  const cargar = consulta.recargar;

  function buscar(e: FormEvent) {
    e.preventDefault();
    setBuscada(identificacion.trim());
  }

  const vencida = (fechaIso: string | null) => !!fechaIso && new Date(fechaIso).getTime() < Date.now();

  return (
    <>
      <EncabezadoPagina titulo="Créditos y abonos" descripcion="Busca al cliente por su identificación para ver y abonar a sus créditos." />

      <Tarjeta className="mb-6">
        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Campo
            className="sm:flex-1"
            etiqueta="Identificación del cliente"
            inputMode="numeric"
            placeholder="Ej. 1085123456"
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value.replace(/\D/g, ""))}
          />
          <Boton type="submit" icono="buscar">
            Buscar
          </Boton>
          {buscada && (
            <Boton
              variante="secundario"
              onClick={() => {
                setIdentificacion("");
                setBuscada("");
              }}
            >
              Ver todos los pendientes
            </Boton>
          )}
        </form>
      </Tarjeta>

      <h2 className="mb-3 text-2xl font-bold">
        {buscada ? `Créditos del cliente ${buscada}` : "Todos los créditos pendientes"}
      </h2>

      {!creditos ? (
        <Cargando />
      ) : creditos.length === 0 ? (
        <Vacio icono="credito" titulo={buscada ? "Este cliente no tiene créditos" : "No hay créditos pendientes"}>
          {buscada ? "Revisa que la identificación esté bien escrita." : "¡Todos los créditos están al día!"}
        </Vacio>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {creditos.map((c) => {
            const pagado = c.total - c.saldo;
            const porcentaje = Math.round((pagado / c.total) * 100);
            return (
              <li key={c.id}>
                <Tarjeta className={`h-full ${c.estado === "PENDIENTE" && vencida(c.proximaCuota) ? "border-peligro-700" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-2xl font-bold">{c.clienteNombre}</h3>
                      <p className="text-base text-texto-suave">
                        C.C. {c.clienteIdentificacion} · Tel. {c.clienteTelefono}
                      </p>
                      <p className="text-base text-texto-suave">
                        Factura N° {numeroFactura(c.numero)} · {fechaHora(c.creadoEn)}
                      </p>
                    </div>
                    <Insignia tono={c.estado === "COMPLETADA" ? "exito" : "alerta"}>
                      {c.estado === "COMPLETADA" ? "Completado" : "Pendiente"}
                    </Insignia>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-lg">
                    <div><dt className="text-base font-bold text-texto-suave">Valor del crédito</dt><dd className="font-bold">{pesos(c.total)}</dd></div>
                    <div><dt className="text-base font-bold text-texto-suave">Saldo pendiente</dt><dd className="text-xl font-bold text-peligro-700">{pesos(c.saldo)}</dd></div>
                    <div><dt className="text-base font-bold text-texto-suave">Cuotas pagadas</dt><dd>{c.cuotasPagadas} de {c.totalCuotas}</dd></div>
                    <div>
                      <dt className="text-base font-bold text-texto-suave">{c.estado === "COMPLETADA" ? "Pagado el" : "Próximo cobro"}</dt>
                      <dd className={vencida(c.proximaCuota) && c.estado === "PENDIENTE" ? "font-bold text-peligro-700" : ""}>
                        {c.estado === "COMPLETADA"
                          ? c.completadaEn && fechaHora(c.completadaEn)
                          : c.proximaCuota
                            ? `${fechaHora(c.proximaCuota)}${vencida(c.proximaCuota) ? " (vencido)" : ""}`
                            : "—"}
                      </dd>
                    </div>
                  </dl>

                  {/* Barra de progreso con texto */}
                  <div className="mt-4">
                    <div className="h-4 overflow-hidden rounded-full bg-linea" aria-hidden="true">
                      <div className="h-full rounded-full bg-exito-700" style={{ width: `${porcentaje}%` }} />
                    </div>
                    <p className="mt-1 text-base font-bold">
                      Pagado {pesos(pagado)} ({porcentaje}%)
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.estado === "PENDIENTE" && (
                      <Boton icono="dinero" onClick={() => setAbonando(c.id)}>
                        Abonar
                      </Boton>
                    )}
                    <Boton variante="secundario" icono="calendario" onClick={() => setCuotasDe(c.id)}>
                      Cuotas y abonos
                    </Boton>
                    <Boton variante="secundario" icono="factura" onClick={() => setDetalleId(c.id)}>
                      Ver factura
                    </Boton>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {abonando && (
        <ModalAbono
          facturaId={abonando}
          onCerrar={() => setAbonando(null)}
          onListo={(f) => {
            setAbonando(null);
            if (f.estado === "COMPLETADA") avisos.exito(`¡Crédito de ${f.clienteNombre} pagado! Pasó a ventas completadas.`);
            else avisos.exito(`Abono registrado. Saldo pendiente: ${pesos(f.saldo)}`);
            avisarCambioNotificaciones();
            cargar();
          }}
        />
      )}
      {cuotasDe && <ModalCuotas facturaId={cuotasDe} onCerrar={() => setCuotasDe(null)} onCambio={cargar} />}
      <DetalleFactura facturaId={detalleId} onCerrar={() => setDetalleId(null)} />
    </>
  );
}

/* --------------------------------- Abonar --------------------------------- */

function ModalAbono({ facturaId, onCerrar, onListo }: { facturaId: string; onCerrar: () => void; onListo: (f: FacturaDetalle) => void }) {
  const consulta = useConsulta<{ factura: FacturaDetalle }>(`/api/facturas/${facturaId}`);
  const factura = consulta.datos?.factura ?? null;
  const [valor, setValor] = useState(0);
  const [nota, setNota] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | null>(null);
  const [transferencia, setTransferencia] = useState(0);
  const [errorPago, setErrorPago] = useState("");
  const [errorGuardar, setError] = useState("");
  const error = errorGuardar || consulta.error;
  const [cargando, setCargando] = useState(false);

  const proxima = factura?.cuotas.find((c) => c.estado === "PENDIENTE");
  const valorProxima = proxima ? proxima.valor - proxima.valorPagado : 0;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!factura) return;
    if (valor <= 0) return setError("Escribe el valor del abono.");
    if (valor > factura.saldo) return setError(`El abono no puede ser mayor que el saldo (${pesos(factura.saldo)}).`);
    if (!medioPago) return setErrorPago("Elige el medio de pago.");
    const { error: errorReparto } = calcularPago(medioPago, valor, transferencia);
    if (errorReparto) return setErrorPago(errorReparto);
    setErrorPago("");
    setCargando(true);
    setError("");
    try {
      const { factura: actualizada } = await api<{ factura: FacturaDetalle }>(`/api/creditos/${facturaId}/abonos`, {
        method: "POST",
        json: {
          valor,
          nota: nota.trim() || undefined,
          medioPago,
          // En Mixto se envían los dos valores: el servidor los compara con el valor del abono
          ...(medioPago === "MIXTO" ? { valorTransferencia: transferencia, valorEfectivo: valor - transferencia } : {}),
        },
      });
      onListo(actualizada);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar abono">
      {!factura ? (
        error ? <Mensaje tono="peligro">{error}</Mensaje> : <Cargando />
      ) : (
        <form onSubmit={guardar} className="space-y-5" noValidate>
          <div className="rounded-xl bg-superficie p-4 text-lg">
            <p className="font-bold">{factura.clienteNombre}</p>
            <p>
              Saldo pendiente: <strong className="text-peligro-700">{pesos(factura.saldo)}</strong>
            </p>
            {proxima && (
              <p>
                Cuota {proxima.numero}: {pesos(valorProxima)} · {fechaHora(proxima.fechaVencimiento)}
              </p>
            )}
          </div>
          {error && <Mensaje tono="peligro">{error}</Mensaje>}
          <CampoDinero etiqueta="Valor del abono" valor={valor} onCambio={setValor} obligatorio />
          {/* Atajos para no tener que escribir el valor */}
          <div className="flex flex-wrap gap-2">
            {proxima && valorProxima < factura.saldo && (
              <Boton pequeno variante="secundario" onClick={() => setValor(valorProxima)}>
                Pagar cuota {proxima.numero} ({pesos(valorProxima)})
              </Boton>
            )}
            <Boton pequeno variante="secundario" onClick={() => setValor(factura.saldo)}>
              Pagar todo ({pesos(factura.saldo)})
            </Boton>
          </div>
          <SelectorMedioPago
            titulo="Medio de pago del abono"
            total={valor}
            medio={medioPago}
            onMedio={(m) => {
              setMedioPago(m);
              setErrorPago("");
            }}
            transferencia={transferencia}
            onTransferencia={setTransferencia}
            error={errorPago}
          />
          <Campo etiqueta="Nota (opcional)" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />
          {valor > 0 && valor <= factura.saldo && (
            <p className="text-lg" aria-live="polite">
              Después del abono quedará un saldo de <strong>{pesos(factura.saldo - valor)}</strong>
              {valor === factura.saldo && " — el crédito quedará COMPLETADO."}
            </p>
          )}
          <Boton type="submit" variante="exito" ancho cargando={cargando} icono="check">
            Registrar abono
          </Boton>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------ Cuotas (editar fechas) y abonos ------------------------ */

function ModalCuotas({ facturaId, onCerrar, onCambio }: { facturaId: string; onCerrar: () => void; onCambio: () => void }) {
  const avisos = useAvisos();
  const [fechas, setFechas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const consulta = useConsulta<{ factura: FacturaDetalle }>(`/api/facturas/${facturaId}`, {
    alCargar: ({ factura: f }) =>
      setFechas(Object.fromEntries(f.cuotas.map((c) => [c.id, aInputFechaHora(new Date(c.fechaVencimiento))]))),
  });
  const factura = consulta.datos?.factura ?? null;
  const error = consulta.error;
  const cargar = consulta.recargar;

  async function guardarFecha(cuotaId: string) {
    const valor = fechas[cuotaId];
    if (!valor) return avisos.error("Escribe una fecha válida.");
    setGuardando(cuotaId);
    try {
      await api(`/api/creditos/cuotas/${cuotaId}`, { method: "PUT", json: { fechaVencimiento: new Date(valor).toISOString() } });
      avisos.exito("Fecha de cobro actualizada.");
      avisarCambioNotificaciones();
      await cargar();
      onCambio();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={factura ? `Cuotas de ${factura.clienteNombre}` : "Cuotas"} tamano="lg">
      {error ? (
        <Mensaje tono="peligro">{error}</Mensaje>
      ) : !factura ? (
        <Cargando />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-xl font-bold">Plan de pagos</h3>
            <ol className="space-y-3">
              {factura.cuotas.map((c) => (
                <li key={c.id} className="rounded-xl border-2 border-linea p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-bold">
                      Cuota {c.numero} · {pesos(c.valor)}
                    </p>
                    <Insignia tono={c.estado === "PAGADA" ? "exito" : c.valorPagado > 0 ? "info" : "alerta"}>
                      {c.estado === "PAGADA" ? "Pagada" : c.valorPagado > 0 ? `Abonado ${pesos(c.valorPagado)}` : "Pendiente"}
                    </Insignia>
                  </div>
                  {c.estado === "PAGADA" ? (
                    <p className="mt-1 text-base text-texto-suave">
                      Fecha de cobro: {fechaHora(c.fechaVencimiento)} · Pagada el {c.pagadaEn && fechaHora(c.pagadaEn)}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <Campo
                        className="sm:flex-1"
                        etiqueta="Fecha y hora de cobro"
                        type="datetime-local"
                        value={fechas[c.id] ?? ""}
                        onChange={(e) => setFechas({ ...fechas, [c.id]: e.target.value })}
                      />
                      <Boton
                        variante="secundario"
                        icono="check"
                        cargando={guardando === c.id}
                        disabled={fechas[c.id] === aInputFechaHora(new Date(c.fechaVencimiento))}
                        onClick={() => guardarFecha(c.id)}
                      >
                        Guardar fecha
                      </Boton>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-xl font-bold">Abonos recibidos</h3>
            {factura.abonos.length === 0 ? (
              <p className="text-lg text-texto-suave">Aún no hay abonos.</p>
            ) : (
              <ul className="space-y-2">
                {factura.abonos.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-superficie px-4 py-3 text-lg">
                    <span>
                      {fechaHora(a.creadoEn)} · {textoMedioPago(a.medioPago)}
                      {a.medioPago === "MIXTO" ? ` (efectivo ${pesos(a.valorEfectivo)} + transferencia ${pesos(a.valorTransferencia)})` : ""}
                      {a.nota ? ` · ${a.nota}` : ""}
                    </span>
                    <strong>{pesos(a.valor)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
