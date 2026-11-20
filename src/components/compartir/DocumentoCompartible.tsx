/**
 * Documento listo para entregar al cliente (factura o comprobante de abono), con sus botones:
 *  - "Enviar por WhatsApp al cliente" (verde, el primero): abre WhatsApp con el texto ya escrito.
 *  - "Compartir imagen", "Compartir PDF", "Descargar PDF" e "Imprimir".
 * El contenido (children) es lo que se convierte en imagen/PDF. Usa colores sólidos y letra Arial
 * para que la imagen se vea igual en cualquier equipo.
 */
"use client";

import type { ReactNode } from "react";
import { useCompartirDocumento } from "@/hooks/useCompartirDocumento";
import { Boton } from "../ui/Boton";
import { useAvisos } from "../ui/Avisos";

interface Props {
  /** Título al compartir (por ejemplo "Factura 000007"). */
  titulo: string;
  /** Nombre del archivo sin extensión (por ejemplo "Factura_000007_Ivan_vallejo"). */
  nombreArchivo: string;
  /**
   * Botón de WhatsApp: el enlace listo (null si el teléfono no es un celular válido) y el teléfono
   * para el mensaje de error. Si no se pasa, no se muestra el botón (por ejemplo, un abono anulado).
   */
  whatsapp?: { enlace: string | null; telefono: string };
  /** Si se pasa, reemplaza TODOS los botones (por ejemplo, una venta anulada no se comparte). */
  bloqueo?: ReactNode;
  children: ReactNode;
}

export function DocumentoCompartible({ titulo, nombreArchivo, whatsapp, bloqueo, children }: Props) {
  const avisos = useAvisos();
  const { ref, ocupado, ejecutar, imprimir } = useCompartirDocumento({ titulo, nombreArchivo });

  function enviarWhatsApp() {
    if (!whatsapp?.enlace) {
      avisos.error(`El teléfono «${whatsapp?.telefono ?? ""}» no es un celular válido. No se puede abrir WhatsApp.`);
      return;
    }
    window.open(whatsapp.enlace, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      {bloqueo ? (
        <div className="mb-5">{bloqueo}</div>
      ) : (
        <>
          {/* Botones de acción grandes: WhatsApp primero y en verde */}
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {whatsapp && (
              <Boton variante="exito" icono="mensaje" onClick={enviarWhatsApp}>
                Enviar por WhatsApp al cliente
              </Boton>
            )}
            <Boton icono="compartir" cargando={ocupado === "imagen"} disabled={!!ocupado} onClick={() => ejecutar("imagen")}>
              Compartir imagen
            </Boton>
          </div>
          {whatsapp && (
            <p className="mb-3 text-base text-texto-suave">
              WhatsApp no permite adjuntar la imagen automáticamente desde un enlace: el mensaje lleva el detalle en texto. Si quieres enviar la imagen, usa «Compartir imagen».
            </p>
          )}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Boton icono="compartir" variante="secundario" cargando={ocupado === "pdf"} disabled={!!ocupado} onClick={() => ejecutar("pdf")}>
              Compartir PDF
            </Boton>
            <Boton icono="descargar" variante="secundario" cargando={ocupado === "pdf-descarga"} disabled={!!ocupado} onClick={() => ejecutar("pdf-descarga")}>
              Descargar PDF
            </Boton>
            <Boton icono="imprimir" variante="secundario" disabled={!!ocupado} onClick={imprimir}>
              Imprimir
            </Boton>
          </div>
        </>
      )}

      {/* ---------------- Documento (esto es lo que se convierte en imagen/PDF) ---------------- */}
      <div className="overflow-x-auto rounded-xl border-2 border-linea bg-superficie-apagada p-2 sm:p-4">
        <div
          ref={ref}
          className="documento-imprimible mx-auto w-[440px] max-w-none bg-white p-6 text-[15px] leading-snug text-black"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Fila "etiqueta ...... valor" del documento. */
export function FilaDocumento({ etiqueta, valor, className = "" }: { etiqueta: string; valor: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${className}`}>
      <span>{etiqueta}</span>
      <span className="whitespace-nowrap">{valor}</span>
    </div>
  );
}

/** Encabezado del local (nombre, dirección y teléfono), igual en la factura y en el comprobante. */
export function EncabezadoLocal({ local }: { local: { nombre: string; direccion: string | null; telefono: string | null } }) {
  return (
    <>
      <p className="text-[22px] font-bold">{local.nombre}</p>
      {local.direccion && <p>{local.direccion}</p>}
      {local.telefono && <p>Tel. {local.telefono}</p>}
    </>
  );
}

/** Nombre del cliente apto para un nombre de archivo ("Iván Pérez" → "Iván_Pérez"). */
export const nombreParaArchivo = (texto: string) => texto.replace(/[^\p{L}\p{N}]+/gu, "_");
