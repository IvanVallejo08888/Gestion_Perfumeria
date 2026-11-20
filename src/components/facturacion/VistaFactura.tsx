/**
 * Factura lista para compartir (WhatsApp, imagen, PDF e impresión: ver DocumentoCompartible).
 *
 * En un crédito, al cliente NO se le muestran las cuotas ni sus fechas (son de uso interno:
 * cobros, avisos y la pantalla Créditos). Debajo del total va solo la forma de pago, lo abonado
 * y el saldo pendiente, con los datos actuales de la factura (si se comparte después de varios
 * abonos, se ve el saldo al día).
 */
"use client";

import { describirClasificacion, ETIQUETA_TIPO } from "@/lib/clasificacion";
import { fecha, fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { FacturaDetalle } from "@/tipos";
import { DocumentoCompartible, EncabezadoLocal, FilaDocumento as Fila, nombreParaArchivo } from "../compartir/DocumentoCompartible";
import { Mensaje } from "../ui/Basicos";

export function VistaFactura({ factura }: { factura: FacturaDetalle }) {
  const esCredito = factura.tipo === "CREDITO";
  const abonado = factura.total - factura.saldo;

  /* Venta anulada: se puede ver, pero no compartir (el cliente no debe recibir una factura que ya no vale) */
  const bloqueo = factura.anulada ? (
    <Mensaje tono="peligro" titulo="Venta eliminada (anulada)">
      <p>Motivo: {factura.motivoAnulacion}</p>
      <p>
        Eliminada por {factura.anuladaPorNombre ?? "—"}
        {factura.anuladaEn ? ` el ${fechaHora(factura.anuladaEn)}` : ""}.
      </p>
      <p>Esta factura no se puede enviar ni compartir.</p>
    </Mensaje>
  ) : undefined;

  return (
    <DocumentoCompartible
      titulo={`Factura ${numeroFactura(factura.numero)}`}
      nombreArchivo={`Factura_${numeroFactura(factura.numero)}_${nombreParaArchivo(factura.clienteNombre)}`}
      whatsapp={{ enlace: enlaceWhatsApp(factura), telefono: factura.clienteTelefono }}
      bloqueo={bloqueo}
    >
      <div className="text-center">
        <EncabezadoLocal local={factura.local} />
        <p className={`mt-3 inline-block rounded px-3 py-1 text-[16px] font-bold text-white ${esCredito ? "bg-[#92400e]" : "bg-[#4b0081]"}`}>
          {esCredito ? "FACTURA DE CRÉDITO" : "FACTURA DE VENTA"} N° {numeroFactura(factura.numero)}
        </p>
        <p className="mt-1">{fechaHora(factura.creadoEn)}</p>
      </div>

      <div className="mt-4 border-y border-dashed border-black py-3">
        <p><b>Cliente:</b> {factura.clienteNombre}</p>
        <p><b>Identificación:</b> {factura.clienteIdentificacion}</p>
        <p><b>Teléfono:</b> {factura.clienteTelefono}</p>
        <p><b>Dirección:</b> {factura.clienteDireccion}</p>
        <p><b>Sector:</b> {factura.clienteSector}</p>
      </div>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">Producto</th>
            <th className="py-1 text-center">Cant.</th>
            <th className="py-1 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {factura.items.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="py-1 pr-2 break-words">
                {i.nombreProducto}
                {/*
                 * Ventas nuevas: el nombre ya trae marca, concentración, ml y género ("· ");
                 * solo se agrega el tipo (Original, 1.1…). Facturas antiguas: la clasificación como antes.
                 */}
                {i.nombreProducto.includes(" · ") ? (
                  i.tipo && (
                    <>
                      <br />
                      <span className="text-[15px]">{ETIQUETA_TIPO[i.tipo]}</span>
                    </>
                  )
                ) : (
                  <>
                    <br />
                    <span className="text-[15px]">{describirClasificacion(i)}</span>
                  </>
                )}
                <br />
                <span className="text-[15px]">{pesos(i.precioUnitario)} c/u</span>
              </td>
              <td className="py-1 text-center">{i.cantidad}</td>
              <td className="py-1 text-right whitespace-nowrap">{pesos(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 space-y-0.5 border-t border-dashed border-black pt-2">
        <Fila etiqueta="Subtotal" valor={pesos(factura.subtotal)} />
        {factura.adicional > 0 && <Fila etiqueta="Costo adicional" valor={`+ ${pesos(factura.adicional)}`} />}
        {factura.descuento > 0 && <Fila etiqueta="Descuento" valor={`− ${pesos(factura.descuento)}`} />}
        <div className="flex justify-between pt-1 text-[20px] font-bold">
          <span>TOTAL</span>
          <span>{pesos(factura.total)}</span>
        </div>
        {factura.medioPago && <Fila etiqueta="Medio de pago" valor={textoMedioPago(factura.medioPago)} />}
        {factura.medioPago === "MIXTO" && (
          <>
            <Fila etiqueta="Efectivo" valor={pesos(factura.valorEfectivo)} />
            <Fila etiqueta="Transferencia" valor={pesos(factura.valorTransferencia)} />
          </>
        )}
      </div>

      {/* Crédito: forma de pago, lo abonado y el saldo de hoy (sin cuotas ni fechas de cobro) */}
      {esCredito && (
        <div className="mt-3 space-y-0.5 border-t border-dashed border-black pt-2">
          <Fila etiqueta="Forma de pago" valor="Crédito" />
          {abonado > 0 && <Fila etiqueta="Total abonado" valor={pesos(abonado)} />}
          <div className="mt-1 flex justify-between rounded bg-[#fef3c7] px-2 py-1.5 text-[19px] font-bold">
            <span>Saldo pendiente</span>
            <span>{pesos(factura.saldo)}</span>
          </div>
          {factura.estado === "COMPLETADA" && factura.completadaEn && (
            <p className="mt-2 rounded bg-[#166534] px-2 py-1.5 text-center font-bold text-white">
              CRÉDITO PAGADO el {fecha(factura.completadaEn)}
            </p>
          )}
        </div>
      )}

      {factura.notas && <p className="mt-3 text-[15px]"><b>Notas:</b> {factura.notas}</p>}
      <p className="mt-4 text-center text-[15px]">Atendido por: {factura.vendedorNombre}</p>
      <p className="mt-1 text-center font-bold">¡Gracias por su compra!</p>
    </DocumentoCompartible>
  );
}
