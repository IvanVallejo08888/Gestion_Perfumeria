/**
 * Ventana con el detalle de una factura (se carga desde la API por su id).
 * Se usa en el Historial y en Créditos.
 */
"use client";

import { useConsulta } from "@/hooks/useConsulta";
import type { FacturaDetalle } from "@/tipos";
import { Cargando, Mensaje } from "../ui/Basicos";
import { Modal } from "../ui/Modal";
import { VistaFactura } from "./VistaFactura";

export function DetalleFactura({ facturaId, onCerrar }: { facturaId: string | null; onCerrar: () => void }) {
  const url = facturaId ? `/api/facturas/${facturaId}` : null;
  const { datos, urlDatos, error } = useConsulta<{ factura: FacturaDetalle }>(url);
  // Mientras carga otra factura no se muestra la anterior
  const factura = urlDatos === url ? (datos?.factura ?? null) : null;

  return (
    <Modal abierto={facturaId !== null} onCerrar={onCerrar} titulo={factura ? `Factura de ${factura.clienteNombre}` : "Detalle de factura"} tamano="xl">
      {error ? <Mensaje tono="peligro">{error}</Mensaje> : !factura ? <Cargando /> : <VistaFactura factura={factura} />}
    </Modal>
  );
}
