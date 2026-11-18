/**
 * Tarjeta de una factura en una lista (Historial de ventas y récord del cliente).
 * - Muestra cliente, número, fecha, tipo, estado, medio de pago y total.
 * - Una venta anulada lleva la insignia "Anulada" con el motivo, quién y cuándo,
 *   y NUNCA muestra el botón "Eliminar venta".
 */
"use client";

import { fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import type { FacturaResumen } from "@/tipos";
import { Insignia } from "../ui/Basicos";
import { Boton } from "../ui/Boton";

export function TarjetaFactura({
  factura: f,
  onVer,
  onEliminar,
}: {
  factura: FacturaResumen;
  onVer: () => void;
  /** Si se indica, las ventas vigentes muestran el botón rojo "Eliminar venta". */
  onEliminar?: () => void;
}) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        f.anulada ? "border-peligro-700/50" : "border-gray-200"
      }`}
    >
      <div className="min-w-0">
        {/* El nombre de la factura es el nombre del cliente */}
        <h3 className="text-xl font-bold">{f.clienteNombre}</h3>
        <p className="text-base text-texto-suave">
          Factura N° {numeroFactura(f.numero)} · C.C. {f.clienteIdentificacion}
        </p>
        <p className="text-base text-texto-suave">
          {f.estado === "COMPLETADA" && f.tipo === "CREDITO" && f.completadaEn && !f.anulada
            ? `Crédito pagado el ${fechaHora(f.completadaEn)}`
            : fechaHora(f.creadoEn)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Insignia tono={f.tipo === "NORMAL" ? "marca" : "info"}>{f.tipo === "NORMAL" ? "Contado" : "Crédito"}</Insignia>
          {f.anulada ? (
            <Insignia tono="peligro">Anulada</Insignia>
          ) : (
            <Insignia tono={f.estado === "COMPLETADA" ? "exito" : "alerta"}>
              {f.estado === "COMPLETADA" ? "Completada" : `Pendiente: ${pesos(f.saldo)}`}
            </Insignia>
          )}
          {f.medioPago && <Insignia tono="neutro">{textoMedioPago(f.medioPago)}</Insignia>}
        </div>
        {f.medioPago === "MIXTO" && !f.anulada && (
          <p className="mt-1 text-base text-texto-suave">
            Efectivo {pesos(f.valorEfectivo)} + transferencia {pesos(f.valorTransferencia)}
          </p>
        )}
        {f.anulada && (
          <div className="mt-2 rounded-xl bg-peligro-50 px-3 py-2 text-base text-peligro-800">
            <p className="break-words">
              <strong>Motivo:</strong> {f.motivoAnulacion}
            </p>
            <p>
              Eliminada por {f.anuladaPorNombre ?? "—"}
              {f.anuladaEn ? ` el ${fechaHora(f.anuladaEn)}` : ""}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end">
        <p className={`text-2xl font-bold ${f.anulada ? "text-texto-suave line-through" : "text-marca-800"}`}>{pesos(f.total)}</p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Boton variante="secundario" icono="factura" onClick={onVer}>
            Ver detalles
          </Boton>
          {onEliminar && !f.anulada && (
            <Boton
              variante="peligro"
              icono="basura"
              onClick={onEliminar}
              aria-label={`Eliminar venta de ${f.clienteNombre}, factura ${numeroFactura(f.numero)}, por ${pesos(f.total)}`}
            >
              Eliminar venta
            </Boton>
          )}
        </div>
      </div>
    </article>
  );
}
