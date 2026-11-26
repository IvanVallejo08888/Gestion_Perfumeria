/**
 * Caja del día (vendedor): el dinero que entró y salió del local en un día, separado en efectivo y transferencia.
 *  - Entradas: ventas de contado y abonos de clientes.
 *  - Salidas: gastos de contado y pagos de deudas (cada pago sale el día en que se hizo).
 *  - Saldo del día: efectivo neto (lo que debería haber de más en el cajón), transferencia neta y total.
 *  - Detalle de cada movimiento con su hora y descripción.
 *  - Pagos a proveedores: solo informativos (no se restan; la mercancía también se anota como gasto).
 * Los gastos a crédito no aparecen: ese día no sale dinero.
 */
"use client";

import { useState } from "react";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { esEntrada, TEXTO_TIPO_MOVIMIENTO, type TotalesMedio } from "@/lib/caja";
import { fechaLarga, hoyColombia, pesos, ZONA_HORARIA } from "@/lib/formato";
import type { CajaDia } from "@/tipos";

/** Suma o resta días a "AAAA-MM-DD" (en hora de Colombia). */
function moverDia(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00-05:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return hoyColombia(d);
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { timeZone: ZONA_HORARIA, hour: "numeric", minute: "2-digit" });

export default function PaginaCaja() {
  const avisos = useAvisos();
  const hoy = hoyColombia();
  const [dia, setDia] = useState(hoy);
  const consulta = useConsulta<CajaDia>(`/api/caja?fecha=${dia}`, { alError: avisos.error });
  const datos = consulta.urlDatos === `/api/caja?fecha=${dia}` ? consulta.datos : null;

  return (
    <>
      <EncabezadoPagina titulo="Caja del día" descripcion="Lo que entró y salió del local en un día, en efectivo y por transferencia." />

      <Tarjeta className="mb-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Campo
            etiqueta="Día"
            type="date"
            max={hoy}
            value={dia}
            onChange={(e) => e.target.value && e.target.value <= hoy && setDia(e.target.value)}
            ayuda={fechaLarga(new Date(`${dia}T12:00:00-05:00`))}
          />
          <div className="grid grid-cols-3 gap-2">
            <Boton variante="secundario" onClick={() => setDia(moverDia(dia, -1))} aria-label="Día anterior">
              ← Anterior
            </Boton>
            <Boton variante="secundario" onClick={() => setDia(hoy)} disabled={dia === hoy}>
              Hoy
            </Boton>
            <Boton variante="secundario" onClick={() => setDia(moverDia(dia, 1))} disabled={dia >= hoy} aria-label="Día siguiente">
              Siguiente →
            </Boton>
          </div>
        </div>
      </Tarjeta>

      {consulta.error && !datos ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !datos ? (
        <Cargando />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <BloqueTotales
              titulo="Entradas"
              tono="exito"
              totales={datos.resumen.entradas}
              detalle={[
                ["Ventas de contado", datos.resumen.porTipo.VENTA],
                ["Abonos de clientes", datos.resumen.porTipo.ABONO],
              ]}
            />
            <BloqueTotales
              titulo="Salidas"
              tono="peligro"
              totales={datos.resumen.salidas}
              detalle={[
                ["Gastos de contado", datos.resumen.porTipo.GASTO],
                ["Pagos de deudas", datos.resumen.porTipo.PAGO_DEUDA],
              ]}
            />
            <SaldoDelDia saldo={datos.resumen.saldo} />
          </div>

          <section aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos" className="mb-3 text-2xl font-bold">
              Movimientos del día ({datos.movimientos.length})
            </h2>
            {datos.movimientos.length === 0 ? (
              <Vacio icono="dinero" titulo="Sin movimientos este día">
                No hubo ventas de contado, abonos, gastos de contado ni pagos de deudas.
              </Vacio>
            ) : (
              <ul className="space-y-2">
                {datos.movimientos.map((m, i) => {
                  const entra = esEntrada(m.tipo);
                  const signo = entra ? "+" : "−";
                  return (
                    <li key={i} className="flex flex-col gap-2 rounded-xl border-2 border-linea bg-tarjeta p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold">{m.hora ? hora(m.hora) : "Sin hora"}</span>
                          <Insignia tono={entra ? "exito" : "peligro"}>
                            {entra ? "Entrada" : "Salida"} · {TEXTO_TIPO_MOVIMIENTO[m.tipo]}
                          </Insignia>
                        </div>
                        <p className="text-lg break-words">{m.descripcion}</p>
                      </div>
                      <div className={`text-lg font-bold sm:text-right ${entra ? "text-exito-800" : "text-peligro-800"}`}>
                        {m.efectivo > 0 && (
                          <p>
                            {signo} {pesos(m.efectivo)} efectivo
                          </p>
                        )}
                        {m.transferencia > 0 && (
                          <p>
                            {signo} {pesos(m.transferencia)} transferencia
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {datos.pagosProveedores.length > 0 && (
            <section aria-labelledby="titulo-proveedores">
              <h2 id="titulo-proveedores" className="mb-1 text-2xl font-bold">
                Pagos a proveedores · {pesos(datos.totalPagosProveedores)}
              </h2>
              <p className="mb-3 text-base text-texto-suave">
                Solo informativo: no se restan del saldo. La mercancía se anota también como gasto; si ya la anotaste, está en «Gastos de contado».
              </p>
              <ul className="space-y-2">
                {datos.pagosProveedores.map((p, i) => (
                  <li key={i} className="flex flex-col gap-1 rounded-xl border-2 border-dashed border-linea bg-superficie p-3 sm:flex-row sm:justify-between">
                    <span className="text-lg break-words">
                      <strong>{p.hora ? hora(p.hora) : "Sin hora"}</strong> · {p.descripcion}
                    </span>
                    <span className="text-lg font-bold">
                      {p.efectivo > 0 && `${pesos(p.efectivo)} efectivo `}
                      {p.transferencia > 0 && `${pesos(p.transferencia)} transferencia`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function BloqueTotales({
  titulo,
  tono,
  totales,
  detalle,
}: {
  titulo: string;
  tono: "exito" | "peligro";
  totales: TotalesMedio;
  detalle: [string, TotalesMedio][];
}) {
  return (
    <section
      aria-label={titulo}
      className={`rounded-2xl border-2 bg-tarjeta p-4 shadow-sm ${tono === "exito" ? "border-exito-700" : "border-peligro-700"}`}
    >
      <h2 className="text-2xl font-bold">
        {titulo} · {pesos(totales.total)}
      </h2>
      {/* En escritorio las tres tarjetas van lado a lado y son angostas: efectivo y transferencia se apilan */}
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-lg lg:grid-cols-1">

        <div>
          <dt className="text-base font-bold text-texto-suave">Efectivo</dt>
          <dd className="text-xl font-bold">{pesos(totales.efectivo)}</dd>
        </div>
        <div>
          <dt className="text-base font-bold text-texto-suave">Transferencia</dt>
          <dd className="text-xl font-bold">{pesos(totales.transferencia)}</dd>
        </div>
      </dl>
      <ul className="mt-3 space-y-1 border-t border-linea pt-3 text-base">
        {detalle.map(([nombre, t]) => (
          <li key={nombre} className="flex justify-between gap-2">
            <span>{nombre}</span>
            <strong>{pesos(t.total)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SaldoDelDia({ saldo }: { saldo: TotalesMedio }) {
  const fila = (nombre: string, valor: number, ayuda: string) => (
    <div>
      <dt className="text-base font-bold text-texto-suave">{nombre}</dt>
      <dd className={`text-2xl font-bold ${valor < 0 ? "text-peligro-800" : "text-acento"}`}>
        {valor < 0 ? `− ${pesos(-valor)}` : pesos(valor)}
      </dd>
      <dd className="text-base text-texto-suave">{ayuda}</dd>
    </div>
  );
  return (
    <section aria-label="Saldo del día" className="rounded-2xl border-2 border-marca-700 bg-tarjeta p-4 shadow-sm">
      <h2 className="text-2xl font-bold">Saldo del día</h2>
      <dl className="mt-2 space-y-3">
        {fila("Efectivo neto", saldo.efectivo, saldo.efectivo < 0 ? "Salió más efectivo del que entró" : "Lo que debería haber de más en el cajón")}
        {fila("Transferencia neta", saldo.transferencia, "Entradas − salidas por transferencia")}
        {fila("Total", saldo.total, "Entradas − salidas")}
      </dl>
    </section>
  );
}
