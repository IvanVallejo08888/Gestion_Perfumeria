/**
 * Lógica para compartir un documento en pantalla (factura o comprobante de abono):
 *  - generar una imagen PNG o un PDF a partir del elemento (ref);
 *  - compartirlo con el menú nativo del celular, o descargarlo en computador;
 *  - imprimir SOLO ese documento (aunque haya otro abierto detrás, por ejemplo la factura).
 */
"use client";

import { useRef, useState } from "react";
import { useAvisos } from "@/components/ui/Avisos";
import { dataUrlABlob, escalaImagenFactura } from "@/lib/imagen-factura";

export type AccionArchivo = "imagen" | "pdf" | "pdf-descarga";

export function useCompartirDocumento({ titulo, nombreArchivo }: { titulo: string; nombreArchivo: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const avisos = useAvisos();
  const [ocupado, setOcupado] = useState<"" | AccionArchivo>("");

  /**
   * Convierte el documento en imagen PNG (alta resolución).
   * html-to-image copia a la copia del documento los estilos ya calculados de cada elemento. El «mx-auto»
   * que lo centra en pantalla se copiaba como un margen izquierdo fijo (por ejemplo 230 px) y el documento
   * quedaba corrido dentro de una imagen de 440 px de ancho: salía cortado por la derecha.
   * Por eso se anula el margen y se dan el ancho y el alto completos de forma explícita.
   */
  async function generarPng(): Promise<string> {
    const { toPng } = await import("html-to-image");
    const nodo = ref.current!;
    const ancho = nodo.scrollWidth;
    const alto = nodo.scrollHeight;
    return toPng(nodo, {
      width: ancho,
      height: alto,
      style: { margin: "0", maxHeight: "none", overflow: "visible" },
      pixelRatio: escalaImagenFactura(ancho, alto),
      backgroundColor: "#ffffff",
      skipFonts: true,
      cacheBust: true,
    });
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
        await navigator.share({ files: [archivo], title: titulo });
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

  /** Genera la imagen o el PDF y lo comparte (o lo descarga). */
  async function ejecutar(tipo: AccionArchivo) {
    setOcupado(tipo);
    try {
      if (tipo === "imagen") {
        // Sin fetch("data:…"): la CSP lo bloquea (ver dataUrlABlob)
        await compartirODescargar(dataUrlABlob(await generarPng()), `${nombreArchivo}.png`);
      } else {
        await compartirODescargar(await generarPdf(), `${nombreArchivo}.pdf`, tipo === "pdf-descarga");
      }
    } catch (e) {
      console.error(e);
      avisos.error("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setOcupado("");
    }
  }

  /** Marca este documento como el que se imprime (ver @media print en globals.css) y abre la impresión. */
  function imprimir() {
    const nodo = ref.current;
    if (!nodo) return;
    nodo.dataset.imprimir = "si";
    const limpiar = () => {
      delete nodo.dataset.imprimir;
      window.removeEventListener("afterprint", limpiar);
    };
    window.addEventListener("afterprint", limpiar);
    window.print();
  }

  return { ref, ocupado, ejecutar, imprimir };
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
