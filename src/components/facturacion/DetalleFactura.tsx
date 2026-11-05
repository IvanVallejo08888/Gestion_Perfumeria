/**
 * Ventana con el detalle de una factura (se carga desde la API por su id).
 * Se usa en el Historial y en Créditos.
 */
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import type { FacturaDetalle } from "@/tipos";
import { Cargando, Mensaje } from "../ui/Basicos";
import { Modal } from "../ui/Modal";
import { VistaFactura } from "./VistaFactura";

export function DetalleFactura({ facturaId, onCerrar }: { facturaId: string | null; onCerrar: () => void }) {
  const [factura, setFactura] = useState<FacturaDetalle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!facturaId) return;
    setFactura(null);
    setError("");
    api<{ factura: FacturaDetalle }>(`/api/facturas/${facturaId}`)
      .then((d) => setFactura(d.factura))
      .catch((e) => setError((e as Error).message));
  }, [facturaId]);

  return (
    <Modal abierto={facturaId !== null} onCerrar={onCerrar} titulo={factura ? `Factura de ${factura.clienteNombre}` : "Detalle de factura"} tamano="xl">
      {error ? <Mensaje tono="peligro">{error}</Mensaje> : !factura ? <Cargando /> : <VistaFactura factura={factura} />}
    </Modal>
  );
}
