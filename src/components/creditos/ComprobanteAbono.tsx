/**
 * Comprobante de abono para el cliente (mismo estilo y mismos botones que la factura).
 *  - VistaComprobanteAbono: el comprobante con sus botones (WhatsApp, imagen, PDF, imprimir).
 *  - ModalComprobanteAbono: la ventana. Recibe el comprobante ya listo (recién registrado) o
 *    su id (abono antiguo: se carga de GET /api/creditos/abonos/:id).
 *  - ListaAbonos: abonos de un crédito, cada uno con «Ver comprobante».
 *
 * El comprobante NO muestra cuotas ni fechas de cobro. El saldo y el total abonado son los de
 * justo después de ese abono. Un abono anulado (se anuló la venta) se ve con la marca ANULADO
 * y sin el botón de WhatsApp.
 */
"use client";

import { useConsulta } from "@/hooks/useConsulta";
import { fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import { enlaceWhatsAppAbono } from "@/lib/whatsapp";
import type { AbonoDetalle, ComprobanteAbono } from "@/tipos";
import { DocumentoCompartible, EncabezadoLocal, FilaDocumento as Fila, nombreParaArchivo } from "../compartir/DocumentoCompartible";
import { Cargando, Mensaje } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { Modal } from "../ui/Modal";

export function VistaComprobanteAbono({ abono }: { abono: ComprobanteAbono }) {
  const pagado = abono.saldo === 0;
  const nFactura = numeroFactura(abono.factura.numero);

  return (
    <>
      {abono.anulado && (
        <div className="mb-4">
          <Mensaje tono="peligro" titulo="Abono anulado">
            Este abono se anuló junto con la venta. El comprobante ya no vale y no se puede enviar por WhatsApp.
          </Mensaje>
        </div>
      )}
      <DocumentoCompartible
        titulo={`Abono ${abono.numero} · Factura ${nFactura}`}
        nombreArchivo={`Abono_${nFactura}_${abono.numero}_${nombreParaArchivo(abono.factura.clienteNombre)}`}
        whatsapp={abono.anulado ? undefined : { enlace: enlaceWhatsAppAbono(abono), telefono: abono.factura.clienteTelefono }}
      >
        <div className="text-center">
          <EncabezadoLocal local={abono.local} />
          <p className="mt-3 inline-block rounded bg-[#4b0081] px-3 py-1 text-[16px] font-bold text-white">COMPROBANTE DE ABONO</p>
          <p className="mt-1 font-bold">
            Factura N° {nFactura} · Abono N° {abono.numero}
          </p>
          <p>{fechaHora(abono.creadoEn)}</p>
          {abono.anulado && (
            <p className="mx-auto mt-2 w-fit rounded border-4 border-[#b91c1c] px-4 py-1 text-[24px] font-bold tracking-widest text-[#b91c1c]">
              ANULADO
            </p>
          )}
        </div>

        <div className="mt-4 border-y border-dashed border-black py-3">
          <p><b>Cliente:</b> {abono.factura.clienteNombre}</p>
          <p><b>Identificación:</b> {abono.factura.clienteIdentificacion}</p>
          <p><b>Teléfono:</b> {abono.factura.clienteTelefono}</p>
        </div>

        {/* Valor abonado, grande y destacado */}
        <div className="mt-3 rounded border-2 border-[#4b0081] px-3 py-2 text-center">
          <p className="text-[15px]">Valor abonado</p>
          <p className="text-[28px] font-bold">{pesos(abono.valor)}</p>
        </div>

        <div className="mt-3 space-y-0.5">
          <Fila etiqueta="Medio de pago" valor={textoMedioPago(abono.medioPago)} />
          {abono.medioPago === "MIXTO" && (
            <>
              <Fila etiqueta="Efectivo" valor={pesos(abono.valorEfectivo)} />
              <Fila etiqueta="Transferencia" valor={pesos(abono.valorTransferencia)} />
            </>
          )}
        </div>

        <div className="mt-3 space-y-0.5 border-t border-dashed border-black pt-2">
          <Fila etiqueta="Valor del crédito" valor={pesos(abono.factura.total)} />
          <Fila etiqueta="Total abonado" valor={pesos(abono.totalAbonado)} />
          <div className="mt-1 flex justify-between rounded bg-[#fef3c7] px-2 py-1.5 text-[19px] font-bold">
            <span>Saldo pendiente</span>
            <span>{pesos(abono.saldo)}</span>
          </div>
        </div>

        {pagado ? (
          <div className="mt-4 rounded bg-[#166534] px-3 py-3 text-center text-white">
            <p className="text-[18px] font-bold">🎉 ¡CRÉDITO PAGADO POR COMPLETO!</p>
            <p className="mt-1">¡Gracias por tu confianza y por cumplir con todos tus pagos!</p>
          </div>
        ) : (
          <p className="mt-4 text-center font-bold">¡Gracias por tu abono! Tu cumplimiento nos ayuda a seguir atendiéndote mejor.</p>
        )}

        <p className="mt-4 text-center text-[15px]">Recibido por {abono.recibidoPor ?? "—"}</p>
      </DocumentoCompartible>
    </>
  );
}

/**
 * Ventana del comprobante. Con `abono` lo muestra de una vez (recién registrado);
 * con `abonoId` lo carga del servidor (abono antiguo).
 */
export function ModalComprobanteAbono({
  abono,
  abonoId,
  titulo,
  onCerrar,
}: {
  abono?: ComprobanteAbono | null;
  abonoId?: string | null;
  titulo?: string;
  onCerrar: () => void;
}) {
  const url = !abono && abonoId ? `/api/creditos/abonos/${abonoId}` : null;
  const consulta = useConsulta<{ abono: ComprobanteAbono }>(url);
  // Mientras carga otro abono no se muestra el anterior
  const cargado = url && consulta.urlDatos === url ? (consulta.datos?.abono ?? null) : null;
  const comprobante = abono ?? cargado;
  const abierto = !!abono || !!abonoId;

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo ?? "Comprobante de abono"} tamano="xl">
      {consulta.error && !abono ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !comprobante ? (
        <Cargando />
      ) : (
        <VistaComprobanteAbono abono={comprobante} />
      )}
    </Modal>
  );
}

/** Lista de abonos de un crédito; cada uno con su botón «Ver comprobante». */
export function ListaAbonos({ abonos, onVer }: { abonos: AbonoDetalle[]; onVer: (abonoId: string) => void }) {
  if (abonos.length === 0) return <p className="text-lg text-texto-suave">Aún no hay abonos.</p>;
  return (
    <ul className="space-y-2">
      {abonos.map((a) => (
        <li key={a.id} className="rounded-xl bg-superficie px-4 py-3 text-lg">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              {fechaHora(a.creadoEn)} · {textoMedioPago(a.medioPago)}
              {a.medioPago === "MIXTO" ? ` (efectivo ${pesos(a.valorEfectivo)} + transferencia ${pesos(a.valorTransferencia)})` : ""}
              {a.nota ? ` · ${a.nota}` : ""}
            </span>
            <strong>{pesos(a.valor)}</strong>
          </div>
          <Boton
            className="mt-2"
            variante="secundario"
            icono="factura"
            onClick={() => onVer(a.id)}
            aria-label={`Ver comprobante del abono de ${pesos(a.valor)} del ${fechaHora(a.creadoEn)}`}
          >
            Ver comprobante
          </Boton>
        </li>
      ))}
    </ul>
  );
}
