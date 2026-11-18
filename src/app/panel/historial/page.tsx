/**
 * Historial de ventas del local.
 * - Por defecto muestra las VENTAS COMPLETADAS (facturas normales y créditos ya pagados).
 * - Cada factura se identifica con el NOMBRE DEL CLIENTE.
 * - "Ver detalles" abre la factura completa, lista para compartir otra vez.
 * - "Eliminar venta" anula la factura (con motivo) y devuelve los productos al inventario.
 * - El filtro "Anuladas" muestra las ventas eliminadas, con el motivo, quién y cuándo.
 *   Las anuladas no aparecen en los demás filtros (tampoco en "Todas").
 */
"use client";

import { useState } from "react";
import { ConfirmarAnulacion } from "@/components/facturacion/ConfirmarAnulacion";
import { DetalleFactura } from "@/components/facturacion/DetalleFactura";
import { TarjetaFactura } from "@/components/facturacion/TarjetaFactura";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsultaPaginada } from "@/hooks/useConsultaPaginada";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import type { FacturaResumen } from "@/tipos";

const FILTROS = [
  { valor: "COMPLETADA", texto: "Ventas completadas" },
  { valor: "PENDIENTE", texto: "Créditos pendientes" },
  { valor: "", texto: "Todas" },
  { valor: "ANULADA", texto: "Anuladas" },
];

export default function PaginaHistorial() {
  const avisos = useAvisos();
  const [estado, setEstado] = useState("COMPLETADA");
  const [texto, setTexto] = useState("");
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [anularId, setAnularId] = useState<string | null>(null);
  const textoBuscado = useValorDiferido(texto.trim(), 300);

  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (textoBuscado) params.set("q", textoBuscado);

  const {
    items: facturas,
    hayMas,
    cargandoMas,
    cargarMas,
    recargar,
  } = useConsultaPaginada(
    `/api/facturas?${params}`,
    (r: { facturas: FacturaResumen[]; hayMas: boolean }) => ({ items: r.facturas, hayMas: r.hayMas }),
    { alError: avisos.error },
  );

  return (
    <>
      <EncabezadoPagina titulo="Historial de ventas" descripcion="Consulta tus facturas y vuelve a compartirlas cuando quieras." />

      <Tarjeta className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <Campo
            className="lg:flex-1"
            type="search"
            etiqueta="Buscar factura"
            placeholder="Nombre del cliente, identificación o número"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div role="group" aria-label="Filtrar facturas" className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setEstado(f.valor)}
                aria-pressed={estado === f.valor}
                className={`min-h-12 rounded-xl border-2 px-4 text-lg font-bold ${
                  estado === f.valor ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-white hover:bg-gray-50"
                }`}
              >
                {f.texto}
              </button>
            ))}
          </div>
        </div>
      </Tarjeta>

      {!facturas ? (
        <Cargando />
      ) : facturas.length === 0 ? (
        <Vacio icono="historial" titulo={estado === "ANULADA" ? "No hay ventas anuladas" : "No hay facturas para mostrar"}>
          {estado === "ANULADA" ? "Las ventas que elimines aparecerán aquí." : "Las facturas que registres aparecerán aquí."}
        </Vacio>
      ) : (
        <>
          <ul className="space-y-3">
            {facturas.map((f) => (
              <li key={f.id}>
                <TarjetaFactura factura={f} onVer={() => setDetalleId(f.id)} onEliminar={() => setAnularId(f.id)} />
              </li>
            ))}
          </ul>
          {hayMas && (
            <div className="mt-6 flex justify-center">
              <Boton variante="secundario" cargando={cargandoMas} onClick={cargarMas}>
                Ver más facturas
              </Boton>
            </div>
          )}
        </>
      )}

      <DetalleFactura facturaId={detalleId} onCerrar={() => setDetalleId(null)} />
      <ConfirmarAnulacion
        facturaId={anularId}
        onCerrar={() => setAnularId(null)}
        onAnulada={() => {
          setAnularId(null);
          recargar();
        }}
      />
    </>
  );
}
