/**
 * Pestaña «Deudas» de Gastos (vendedor): las deudas del negocio (gastos a crédito).
 *  - Resumen arriba: total adeudado, próximo pago (fecha y valor) y cuotas vencidas.
 *  - Filtro: Pendientes / Pagadas / Anuladas.
 *  - Cada deuda: acreedor, descripción, total, pagado y saldo con barra de progreso, cuotas pagadas,
 *    próxima fecha (en rojo y con la palabra «Vencida» si ya pasó) y los botones
 *    «Pagar», «Ver cuotas y pagos» y «Editar fechas».
 *  - pagarId: abre directamente la ventana de pago de esa deuda (desde «Ir a pagar» en Notificaciones).
 */
"use client";

import { useEffect, useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { estaVencida, textoFormaPagoFinal, TEXTO_ESTADO_DEUDA, type EstadoDeuda } from "@/lib/deudas";
import { fechaDia, fechaHora, pesos } from "@/lib/formato";
import type { DeudaResumen, ListaDeudas } from "@/tipos";
import { useAvisos } from "../ui/Avisos";
import { Cargando, Insignia, Mensaje, Vacio } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { GrupoOpciones } from "../ui/GrupoOpciones";
import { VentanaDetalle, VentanaFechas, VentanaPagar } from "./VentanasDeuda";

const FILTROS: readonly { valor: EstadoDeuda; texto: string }[] = [
  { valor: "PENDIENTE", texto: "Pendientes" },
  { valor: "PAGADA", texto: "Pagadas" },
  { valor: "ANULADA", texto: "Anuladas" },
];

export function PestanaDeudas({
  pagarId,
  verId,
  onCambio,
  onCerrarPago,
}: {
  /** Deuda cuya ventana de pago se abre al entrar (viene de la dirección ?pagar=). */
  pagarId?: string | null;
  /** Deuda cuyo detalle se abre al entrar (viene de «Ver deuda» en la lista de gastos). */
  verId?: string | null;
  /** Se llama después de pagar o anular (para recargar los totales de gastos). */
  onCambio: () => void;
  /** Se llama al cerrar la ventana de pago (para limpiar ?pagar= de la dirección). */
  onCerrarPago?: () => void;
}) {
  const avisos = useAvisos();
  const [estado, setEstado] = useState<EstadoDeuda>("PENDIENTE");
  const consulta = useConsulta<ListaDeudas>(`/api/deudas?estado=${estado}`, { alError: avisos.error });
  const datos = consulta.datos;

  const [pagando, setPagando] = useState<string | null>(pagarId ?? null);
  const [viendo, setViendo] = useState<string | null>(verId ?? null);
  const [fechas, setFechas] = useState<string | null>(null);

  // Si la dirección cambia (otra notificación), se abre la ventana de esa deuda
  useEffect(() => {
    if (pagarId) setPagando(pagarId);
  }, [pagarId]);
  useEffect(() => {
    if (verId) setViendo(verId);
  }, [verId]);

  const recargar = () => {
    consulta.recargar();
    onCambio();
  };

  return (
    <div className="space-y-6">
      {datos && <ResumenDeudas resumen={datos.resumen} onPagar={setPagando} />}

      <div>
        <p className="mb-2 text-lg font-bold" aria-hidden="true">
          Qué deudas ver
        </p>
        <GrupoOpciones etiqueta="Qué deudas ver" opciones={FILTROS} valor={estado} onCambio={setEstado} />
      </div>

      {consulta.error && !datos ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !datos || consulta.urlDatos !== `/api/deudas?estado=${estado}` ? (
        <Cargando />
      ) : datos.deudas.length === 0 ? (
        <Vacio icono="dinero" titulo={`No hay deudas ${FILTROS.find((f) => f.valor === estado)!.texto.toLowerCase()}`}>
          {estado === "PENDIENTE" ? "Para registrar una, crea un gasto con el medio de pago «Crédito»." : "Prueba con otro filtro."}
        </Vacio>
      ) : (
        <ul className="space-y-4">
          {datos.deudas.map((d) => (
            <li key={d.id}>
              <TarjetaDeuda deuda={d} onPagar={() => setPagando(d.id)} onVer={() => setViendo(d.id)} onFechas={() => setFechas(d.id)} />
            </li>
          ))}
        </ul>
      )}

      <VentanaPagar
        deudaId={pagando}
        onCerrar={() => {
          setPagando(null);
          onCerrarPago?.();
        }}
        onPagado={recargar}
      />
      <VentanaDetalle
        deudaId={viendo}
        onCerrar={() => setViendo(null)}
        onCambio={recargar}
        onPagar={(id) => {
          setViendo(null);
          setPagando(id);
        }}
      />
      <VentanaFechas deudaId={fechas} onCerrar={() => setFechas(null)} onCambio={recargar} />
    </div>
  );
}

function ResumenDeudas({ resumen, onPagar }: { resumen: ListaDeudas["resumen"]; onPagar: (id: string) => void }) {
  const proximo = resumen.proximoPago;
  const proximoVencido = proximo ? estaVencida(new Date(proximo.fechaVencimiento)) : false;
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      <li className="rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm">
        <p className="text-lg font-bold text-texto-suave">Total adeudado</p>
        <p className="mt-1 text-3xl font-bold text-acento">{pesos(resumen.totalAdeudado)}</p>
        <p className="text-base text-texto-suave">
          {resumen.cantidadPendientes === 1 ? "1 deuda pendiente" : `${resumen.cantidadPendientes} deudas pendientes`}
        </p>
      </li>
      <li className={`rounded-2xl border-2 bg-tarjeta p-4 shadow-sm ${proximoVencido ? "border-peligro-700" : "border-linea"}`}>
        <p className="text-lg font-bold text-texto-suave">Próximo pago</p>
        {proximo ? (
          <>
            <p className="mt-1 text-3xl font-bold text-acento">{pesos(proximo.valor)}</p>
            <p className={`text-base ${proximoVencido ? "font-bold text-peligro-800" : "text-texto-suave"}`}>
              {proximoVencido && "Vencida · "}
              {fechaHora(proximo.fechaVencimiento)} · {proximo.acreedor}
            </p>
            <Boton pequeno variante="exito" icono="dinero" className="mt-2" onClick={() => onPagar(proximo.deudaId)}>
              Pagar
            </Boton>
          </>
        ) : (
          <p className="mt-1 text-xl font-bold">Sin pagos pendientes</p>
        )}
      </li>
      <li className={`rounded-2xl border-2 bg-tarjeta p-4 shadow-sm ${resumen.cuotasVencidas > 0 ? "border-peligro-700" : "border-linea"}`}>
        <p className="text-lg font-bold text-texto-suave">Cuotas vencidas</p>
        <p className={`mt-1 text-3xl font-bold ${resumen.cuotasVencidas > 0 ? "text-peligro-800" : "text-acento"}`}>{resumen.cuotasVencidas}</p>
        <p className="text-base text-texto-suave">{resumen.cuotasVencidas > 0 ? "Hay pagos atrasados" : "Al día"}</p>
      </li>
    </ul>
  );
}

function TarjetaDeuda({ deuda: d, onPagar, onVer, onFechas }: { deuda: DeudaResumen; onPagar: () => void; onVer: () => void; onFechas: () => void }) {
  const porcentaje = d.valorTotal ? Math.round((d.pagado / d.valorTotal) * 100) : 0;
  const proxima = d.proximaCuota;
  const vencida = proxima ? estaVencida(new Date(proxima.fechaVencimiento)) : false;
  return (
    <article
      className={`rounded-2xl border-2 bg-tarjeta p-4 shadow-sm ${
        d.estado === "ANULADA" ? "border-peligro-700/50" : vencida ? "border-peligro-700" : d.estado === "PAGADA" ? "border-exito-700" : "border-linea"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold break-words">{d.acreedor}</h3>
          {d.descripcion && <p className="text-lg break-words">{d.descripcion}</p>}
          <p className="text-base text-texto-suave">
            {d.categoriaNombre} · adquirida el {fechaDia(d.fecha)}
            {d.personal && " · personal (no se resta de la utilidad)"}
          </p>
        </div>
        <Insignia tono={d.estado === "PAGADA" ? "exito" : d.estado === "ANULADA" ? "peligro" : vencida ? "peligro" : "alerta"}>
          {vencida && d.estado === "PENDIENTE" ? "Vencida" : TEXTO_ESTADO_DEUDA[d.estado]}
        </Insignia>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-lg">
        <div>
          <dt className="text-base font-bold text-texto-suave">Total</dt>
          <dd className="font-bold">{pesos(d.valorTotal)}</dd>
        </div>
        <div>
          <dt className="text-base font-bold text-texto-suave">Pagado</dt>
          <dd className="font-bold">{pesos(d.pagado)}</dd>
        </div>
        <div>
          <dt className="text-base font-bold text-texto-suave">Saldo</dt>
          <dd className="font-bold text-acento">{pesos(d.saldo)}</dd>
        </div>
      </dl>

      {/* Barra de progreso con su texto (no depende solo del color) */}
      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          aria-label={`Pagado ${porcentaje}%`}
          className="h-4 w-full overflow-hidden rounded-full border border-borde bg-superficie"
        >
          <div className={`h-full ${d.estado === "PAGADA" ? "bg-exito-700" : "bg-marca-700"}`} style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="mt-1 text-base">
          Pagado {porcentaje}% · {d.cuotasPagadas} de {d.totalCuotas} cuotas pagadas
        </p>
      </div>

      {d.estado === "PENDIENTE" && proxima && (
        <p className={`mt-2 text-lg ${vencida ? "font-bold text-peligro-800" : ""}`}>
          {vencida ? "Vencida: " : "Próximo pago: "}cuota {proxima.numero} · {pesos(proxima.pendiente)} · {fechaHora(proxima.fechaVencimiento)}
        </p>
      )}
      {d.estado === "PAGADA" && (
        <p className="mt-2 text-lg">
          Pagada completamente el {d.pagadaEn ? fechaHora(d.pagadaEn) : "—"}
          {d.resumenMedioPago && (
            <>
              {" "}
              · Forma de pago: <strong>{textoFormaPagoFinal(d.resumenMedioPago)}</strong>
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {d.estado === "PENDIENTE" && (
          <Boton variante="exito" icono="dinero" onClick={onPagar}>
            Pagar
          </Boton>
        )}
        <Boton variante="secundario" icono="historial" onClick={onVer}>
          Ver cuotas y pagos
        </Boton>
        {d.estado === "PENDIENTE" && (
          <Boton variante="secundario" icono="calendario" onClick={onFechas}>
            Editar fechas
          </Boton>
        )}
      </div>
    </article>
  );
}
