/**
 * Notificaciones del local:
 *  - Recordatorios de cobro según las fechas de las cuotas (vencidos, hoy y próximos 3 días).
 *  - Productos agotados o con poco stock.
 * Se actualizan solas cada minuto.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Vacio } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { fechaHora } from "@/lib/formato";
import { api } from "@/lib/http";
import type { Notificacion } from "@/tipos";

const NIVEL: Record<Notificacion["nivel"], { texto: string; tono: "peligro" | "alerta" | "info" }> = {
  VENCIDA: { texto: "Vencido", tono: "peligro" },
  HOY: { texto: "Hoy", tono: "alerta" },
  PROXIMA: { texto: "Próximo", tono: "info" },
  STOCK_AGOTADO: { texto: "Agotado", tono: "peligro" },
  STOCK_BAJO: { texto: "Stock bajo", tono: "alerta" },
};

export default function PaginaNotificaciones() {
  const [lista, setLista] = useState<Notificacion[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setLista((await api<{ notificaciones: Notificacion[] }>("/api/notificaciones")).notificaciones);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, [cargar]);

  const cobros = lista?.filter((n) => n.tipo === "COBRO") ?? [];
  const stock = lista?.filter((n) => n.tipo === "STOCK") ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        descripcion="Recordatorios de cobro y avisos de inventario."
        acciones={
          <Boton variante="secundario" icono="historial" onClick={cargar}>
            Actualizar
          </Boton>
        }
      />

      {error && (
        <div className="mb-6">
          <Mensaje tono="peligro">{error}</Mensaje>
        </div>
      )}

      {!lista ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio icono="campana" titulo="No tienes notificaciones">
          Aquí verás los cobros pendientes y los productos que se están agotando.
        </Vacio>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="titulo-cobros">
            <h2 id="titulo-cobros" className="mb-3 flex items-center gap-2 text-2xl font-bold">
              <Icono nombre="dinero" className="size-7 text-marca-700" />
              Cobros ({cobros.length})
            </h2>
            {cobros.length === 0 ? (
              <p className="text-lg text-texto-suave">No hay cobros para los próximos días.</p>
            ) : (
              <ul className="space-y-3">
                {cobros.map((n) => (
                  <li key={n.id}>
                    <article
                      className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${
                        n.nivel === "VENCIDA" ? "border-peligro-700" : n.nivel === "HOY" ? "border-alerta-700" : "border-gray-200"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Insignia tono={NIVEL[n.nivel].tono}>{NIVEL[n.nivel].texto}</Insignia>
                          {n.fecha && <span className="text-lg font-bold">{fechaHora(n.fecha)}</span>}
                        </div>
                        <h3 className="mt-1 text-xl font-bold">{n.titulo}</h3>
                        <p className="text-lg text-texto-suave">{n.descripcion}</p>
                      </div>
                      {n.clienteIdentificacion && (
                        <Link
                          href={`/panel/creditos?identificacion=${n.clienteIdentificacion}`}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca-700 px-5 text-lg font-bold text-white hover:bg-marca-800"
                        >
                          <Icono nombre="dinero" />
                          Ir a cobrar
                        </Link>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-stock">
            <h2 id="titulo-stock" className="mb-3 flex items-center gap-2 text-2xl font-bold">
              <Icono nombre="inventario" className="size-7 text-marca-700" />
              Inventario ({stock.length})
            </h2>
            {stock.length === 0 ? (
              <p className="text-lg text-texto-suave">Todos los productos tienen stock suficiente.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {stock.map((n) => (
                  <li key={n.id} className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                    <Insignia tono={NIVEL[n.nivel].tono}>{NIVEL[n.nivel].texto}</Insignia>
                    <h3 className="mt-1 text-lg font-bold">{n.titulo}</h3>
                    <p className="text-base text-texto-suave">{n.descripcion}</p>
                  </li>
                ))}
              </ul>
            )}
            {stock.length > 0 && (
              <Link href="/panel/inventario" className="mt-3 inline-block text-lg font-bold text-marca-800 underline underline-offset-4">
                Ir al inventario
              </Link>
            )}
          </section>
        </div>
      )}
    </>
  );
}
