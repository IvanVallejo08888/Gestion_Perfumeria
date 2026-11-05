/**
 * Historial de ventas del local.
 * - Por defecto muestra las VENTAS COMPLETADAS (facturas normales y créditos ya pagados).
 * - Cada factura se identifica con el NOMBRE DEL CLIENTE.
 * - "Ver detalles" abre la factura completa, lista para compartir otra vez.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { DetalleFactura } from "@/components/facturacion/DetalleFactura";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Insignia, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { useAvisos } from "@/components/ui/Avisos";
import { fechaHora, numeroFactura, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import type { FacturaResumen } from "@/tipos";

const FILTROS = [
  { valor: "COMPLETADA", texto: "Ventas completadas" },
  { valor: "PENDIENTE", texto: "Créditos pendientes" },
  { valor: "", texto: "Todas" },
];

export default function PaginaHistorial() {
  const avisos = useAvisos();
  const [estado, setEstado] = useState("COMPLETADA");
  const [texto, setTexto] = useState("");
  const [facturas, setFacturas] = useState<FacturaResumen[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const cargar = useCallback(
    async (numeroPagina: number) => {
      const params = new URLSearchParams({ pagina: String(numeroPagina) });
      if (estado) params.set("estado", estado);
      if (texto.trim()) params.set("q", texto.trim());
      try {
        const datos = await api<{ facturas: FacturaResumen[]; hayMas: boolean }>(`/api/facturas?${params}`);
        setFacturas((previas) => (numeroPagina === 1 ? datos.facturas : [...(previas ?? []), ...datos.facturas]));
        setHayMas(datos.hayMas);
        setPagina(numeroPagina);
      } catch (e) {
        avisos.error((e as Error).message);
        setFacturas((f) => f ?? []);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado, texto],
  );

  useEffect(() => {
    const t = setTimeout(() => cargar(1), 300);
    return () => clearTimeout(t);
  }, [cargar]);

  async function cargarMas() {
    setCargandoMas(true);
    await cargar(pagina + 1);
    setCargandoMas(false);
  }

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
        <Vacio icono="historial" titulo="No hay facturas para mostrar">
          Las facturas que registres aparecerán aquí.
        </Vacio>
      ) : (
        <>
          <ul className="space-y-3">
            {facturas.map((f) => (
              <li key={f.id}>
                <article className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {/* El nombre de la factura es el nombre del cliente */}
                    <h2 className="text-xl font-bold">{f.clienteNombre}</h2>
                    <p className="text-base text-texto-suave">
                      Factura N° {numeroFactura(f.numero)} · C.C. {f.clienteIdentificacion}
                    </p>
                    <p className="text-base text-texto-suave">
                      {f.estado === "COMPLETADA" && f.tipo === "CREDITO" && f.completadaEn
                        ? `Crédito pagado el ${fechaHora(f.completadaEn)}`
                        : fechaHora(f.creadoEn)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Insignia tono={f.tipo === "NORMAL" ? "marca" : "info"}>{f.tipo === "NORMAL" ? "Contado" : "Crédito"}</Insignia>
                      <Insignia tono={f.estado === "COMPLETADA" ? "exito" : "alerta"}>
                        {f.estado === "COMPLETADA" ? "Completada" : `Pendiente: ${pesos(f.saldo)}`}
                      </Insignia>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <p className="text-2xl font-bold text-marca-800">{pesos(f.total)}</p>
                    <Boton variante="secundario" icono="factura" onClick={() => setDetalleId(f.id)}>
                      Ver detalles
                    </Boton>
                  </div>
                </article>
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
    </>
  );
}
