/**
 * Factura lista para compartir.
 * - "Enviar por WhatsApp": abre WhatsApp con el número del cliente y el resumen de la factura.
 * - "Compartir imagen": genera una imagen PNG y abre el menú de compartir del celular
 *   (WhatsApp, correo…). En computador la descarga.
 * - "Compartir PDF" / "Descargar PDF": genera un PDF con la misma factura.
 * - "Imprimir": imprime solo la factura.
 *
 * La factura usa colores sólidos y letra Arial para que la imagen se vea igual en cualquier equipo.
 */
"use client";

import { useRef, useState } from "react";
import { describirClasificacion } from "@/lib/clasificacion";
import { fecha, fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { FacturaDetalle } from "@/tipos";
import { Boton } from "../ui/Boton";
import { useAvisos } from "../ui/Avisos";

export function VistaFactura({ factura }: { factura: FacturaDetalle }) {
  const ref = useRef<HTMLDivElement>(null);
  const avisos = useAvisos();
  const [ocupado, setOcupado] = useState<"" | "imagen" | "pdf" | "pdf-descarga">("");
  const esCredito = factura.tipo === "CREDITO";
  const nombreBase = `Factura_${numeroFactura(factura.numero)}_${factura.clienteNombre.replace(/[^\p{L}\p{N}]+/gu, "_")}`;

  /** Convierte la factura en imagen PNG (alta resolución). */
  async function generarPng(): Promise<string> {
    const { toPng } = await import("html-to-image");
    return toPng(ref.current!, { pixelRatio: 2.5, backgroundColor: "#ffffff", skipFonts: true, cacheBust: true });
  }

  async function generarPdf(): Promise<Blob> {
    const [png, { jsPDF }] = await Promise.all([generarPng(), import("jspdf")]);
    const imagen = await cargarImagen(png);
    const anchoMm = 100;
    const altoMm = (imagen.height / imagen.width) * anchoMm;
    const pdf = new jsPDF({ unit: "mm", format: [anchoMm + 10, altoMm + 10] });
    pdf.addImage(png, "PNG", 5, 5, anchoMm, altoMm);
    return pdf.output("blob");
  }

  /** Usa el menú nativo de compartir; si no existe (computador), descarga el archivo. */
  async function compartirODescargar(blob: Blob, nombre: string, forzarDescarga = false) {
    const archivo = new File([blob], nombre, { type: blob.type });
    if (!forzarDescarga && typeof navigator.canShare === "function" && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: `Factura ${numeroFactura(factura.numero)}` });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // la persona canceló
      }
    }
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    avisos.info(`Se descargó el archivo «${nombre}».`);
  }

  function enviarWhatsApp() {
    const enlace = enlaceWhatsApp(factura);
    if (!enlace) {
      avisos.error(`El teléfono «${factura.clienteTelefono}» no es un celular válido. No se puede abrir WhatsApp.`);
      return;
    }
    window.open(enlace, "_blank", "noopener,noreferrer");
  }

  async function ejecutar(tipo: "imagen" | "pdf" | "pdf-descarga") {
    setOcupado(tipo);
    try {
      if (tipo === "imagen") {
        const blob = await (await fetch(await generarPng())).blob();
        await compartirODescargar(blob, `${nombreBase}.png`);
      } else {
        await compartirODescargar(await generarPdf(), `${nombreBase}.pdf`, tipo === "pdf-descarga");
      }
    } catch (e) {
      console.error(e);
      avisos.error("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div>
      {/* Botones de acción grandes */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Boton variante="exito" icono="mensaje" onClick={enviarWhatsApp}>
          Enviar por WhatsApp al cliente
        </Boton>
        <Boton icono="compartir" cargando={ocupado === "imagen"} disabled={!!ocupado} onClick={() => ejecutar("imagen")}>
          Compartir imagen
        </Boton>
      </div>
      <p className="mb-3 text-base text-texto-suave">
        WhatsApp no permite adjuntar la imagen automáticamente desde un enlace: el mensaje lleva el detalle en texto. Si quieres enviar la imagen, usa «Compartir imagen».
      </p>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Boton icono="compartir" variante="secundario" cargando={ocupado === "pdf"} disabled={!!ocupado} onClick={() => ejecutar("pdf")}>
          Compartir PDF
        </Boton>
        <Boton icono="descargar" variante="secundario" cargando={ocupado === "pdf-descarga"} disabled={!!ocupado} onClick={() => ejecutar("pdf-descarga")}>
          Descargar PDF
        </Boton>
        <Boton icono="imprimir" variante="secundario" disabled={!!ocupado} onClick={() => window.print()}>
          Imprimir
        </Boton>
      </div>

      {/* ---------------- Factura (esto es lo que se convierte en imagen/PDF) ---------------- */}
      <div className="overflow-x-auto rounded-xl border-2 border-gray-200 bg-gray-100 p-2 sm:p-4">
        <div
          ref={ref}
          id="factura-imprimible"
          className="mx-auto w-[440px] max-w-none bg-white p-6 text-[15px] leading-snug text-black"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <div className="text-center">
            <p className="text-[22px] font-bold">{factura.local.nombre}</p>
            {factura.local.direccion && <p>{factura.local.direccion}</p>}
            {factura.local.telefono && <p>Tel. {factura.local.telefono}</p>}
            <p className="mt-3 inline-block rounded px-3 py-1 text-[16px] font-bold text-white" style={{ background: esCredito ? "#92400e" : "#4c1d95" }}>
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
                  <td className="py-1 pr-2">
                    {i.nombreProducto}
                    <br />
                    <span className="text-[13px]">{describirClasificacion(i)}</span>
                    <br />
                    <span className="text-[13px]">{pesos(i.precioUnitario)} c/u</span>
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

          {esCredito && (
            <div className="mt-3 border-t border-dashed border-black pt-2">
              <p className="font-bold">Plan de pagos ({factura.cuotas.length} cuotas)</p>
              <table className="mt-1 w-full text-[14px]">
                <tbody>
                  {factura.cuotas.map((c) => (
                    <tr key={c.id}>
                      <td className="py-0.5">Cuota {c.numero}</td>
                      <td className="py-0.5">{fechaHora(c.fechaVencimiento)}</td>
                      <td className="py-0.5 text-right">{pesos(c.valor)}</td>
                      <td className="py-0.5 pl-2 text-right font-bold">{c.estado === "PAGADA" ? "Pagada" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {factura.abonos.length > 0 && <Fila etiqueta="Total abonado" valor={pesos(factura.total - factura.saldo)} />}
              <div className="mt-1 flex justify-between text-[17px] font-bold">
                <span>Saldo pendiente</span>
                <span>{pesos(factura.saldo)}</span>
              </div>
              {factura.estado === "COMPLETADA" && factura.completadaEn && (
                <p className="mt-1 text-center font-bold">CRÉDITO PAGADO el {fecha(factura.completadaEn)}</p>
              )}
            </div>
          )}

          {factura.notas && <p className="mt-3 text-[14px]"><b>Notas:</b> {factura.notas}</p>}
          <p className="mt-4 text-center text-[13px]">Atendido por: {factura.vendedorNombre}</p>
          <p className="mt-1 text-center font-bold">¡Gracias por su compra!</p>
        </div>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
