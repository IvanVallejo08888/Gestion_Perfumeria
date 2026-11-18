/**
 * Pantalla "Clientes" del vendedor (solo los clientes de SU local).
 *
 *  - Buscador único "Buscar por nombre, cédula o teléfono": busca mientras se escribe
 *    (espera 250 ms) y vuelve a la página 1.
 *  - Lista de 10 clientes por página, ordenada por la última compra.
 *  - La búsqueda y la página viven en la URL (?q=...&pagina=2): el botón Atrás del celular
 *    regresa a la página anterior de la lista.
 *  - Al tocar un cliente: en computador el detalle se abre debajo del buscador (?cliente=id);
 *    en celular se abre como página completa (/panel/clientes/[id]).
 *  - Si lo buscado coincide EXACTAMENTE con la cédula o el teléfono de un solo cliente,
 *    su detalle se abre solo, debajo del buscador.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DetalleCliente } from "@/components/clientes/DetalleCliente";
import { useAvisos } from "@/components/ui/Avisos";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Campo } from "@/components/ui/Campo";
import { Paginacion } from "@/components/ui/Paginacion";
import { useConsulta } from "@/hooks/useConsulta";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { fecha, pesos } from "@/lib/formato";
import type { ListaClientes as RespuestaClientes } from "@/tipos";

/** Ancho desde el que el detalle se muestra debajo del buscador en lugar de abrir otra página. */
const COMPUTADOR = "(min-width: 1024px)";

export function ListaClientes() {
  const avisos = useAvisos();
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  // La URL es la fuente de verdad: búsqueda, página y cliente abierto
  const qUrl = parametros.get("q") ?? "";
  const paginaUrl = Math.max(1, Number(parametros.get("pagina")) || 1);
  const clienteUrl = parametros.get("cliente");

  /** Arma la dirección con los cambios indicados (null = quitar el parámetro). */
  function urlCon(cambios: Record<string, string | number | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || (clave === "pagina" && valor === 1)) nuevos.delete(clave);
      else nuevos.set(clave, String(valor));
    }
    const texto = nuevos.toString();
    return texto ? `${ruta}?${texto}` : ruta;
  }

  /* Buscador: el texto se escribe libre y, tras 250 ms sin cambios, pasa a la URL (página 1) */
  const [texto, setTexto] = useState(qUrl);
  const textoDiferido = useValorDiferido(texto, 250);
  // Última búsqueda que este campo puso en la URL (para distinguirla de un cambio por el botón Atrás)
  const enviadoRef = useRef(qUrl);
  useEffect(() => {
    const buscado = textoDiferido.trim();
    if (buscado === qUrl) return;
    enviadoRef.current = buscado;
    const destino = urlCon({ q: buscado || null, pagina: null, cliente: null });
    // Al EMPEZAR una búsqueda se agrega una entrada al historial (Atrás regresa a la lista donde estaba);
    // mientras se sigue corrigiendo el texto se reemplaza, para no llenar el historial letra por letra.
    if (!qUrl) router.push(destino, { scroll: false });
    else router.replace(destino, { scroll: false });
    // Solo debe reaccionar al texto escrito (no a cada cambio de la URL)
  }, [textoDiferido]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si la URL cambió por el botón Atrás (no por lo escrito), el campo muestra la búsqueda de esa página
  useEffect(() => {
    if (qUrl === enviadoRef.current) return;
    enviadoRef.current = qUrl;
    setTexto(qUrl);
  }, [qUrl]);

  const consulta = useConsulta<RespuestaClientes>(`/api/clientes?${new URLSearchParams({ q: qUrl, pagina: String(paginaUrl) })}`, {
    alError: avisos.error,
  });
  const datos = consulta.datos;

  // Cliente abierto debajo del buscador: el elegido o el de la coincidencia exacta
  const clienteAbierto = clienteUrl ?? (qUrl && datos?.coincidenciaExacta) ?? null;
  const refDetalle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (clienteUrl) refDetalle.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [clienteUrl]);

  return (
    <>
      <EncabezadoPagina titulo="Clientes" descripcion="Busca a un cliente y revisa su récord de compras." />

      <Tarjeta className="mb-6">
        <Campo
          type="search"
          etiqueta="Buscar por nombre, cédula o teléfono"
          placeholder="Ej. José Núñez, 1085999888 o 315 987 6543"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          ayuda="No importan las tildes, las mayúsculas ni los espacios."
        />
      </Tarjeta>

      {clienteAbierto && (
        <div ref={refDetalle} className="mb-8 scroll-mt-4 rounded-2xl border-2 border-marca-700 bg-superficie p-3 sm:p-5">
          {!clienteUrl && (
            <p className="mb-3 text-lg font-bold text-acento" role="status">
              Coincidencia exacta de cédula o teléfono:
            </p>
          )}
          <DetalleCliente
            clienteId={clienteAbierto}
            onCerrar={() =>
              clienteUrl ? router.push(urlCon({ cliente: null }), { scroll: false }) : setTexto("")
            }
            onEditado={consulta.recargar}
          />
        </div>
      )}

      {consulta.error && !datos ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !datos ? (
        <Cargando />
      ) : datos.clientes.length === 0 ? (
        <Vacio icono="usuarios" titulo={qUrl ? "No encontramos clientes con esa búsqueda" : "Aún no hay clientes"}>
          {qUrl ? "Revisa lo que escribiste o prueba con la cédula o el teléfono." : "Los clientes aparecen aquí al registrar su primera factura."}
        </Vacio>
      ) : (
        <>
          <h2 className="sr-only">Lista de clientes</h2>
          <ul className="grid gap-3 lg:grid-cols-2" aria-busy={consulta.cargando || undefined}>
            {datos.clientes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/panel/clientes/${c.id}`}
                  onClick={(e) => {
                    // En computador el detalle se abre aquí mismo, debajo del buscador
                    if (window.matchMedia(COMPUTADOR).matches) {
                      e.preventDefault();
                      router.push(urlCon({ cliente: c.id }), { scroll: false });
                    }
                  }}
                  aria-current={clienteAbierto === c.id ? "true" : undefined}
                  className={`block h-full rounded-2xl border-2 bg-tarjeta p-4 shadow-sm transition-colors hover:border-marca-700 hover:bg-marca-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-200 ${
                    clienteAbierto === c.id ? "border-marca-700" : "border-linea"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-xl font-bold break-words text-acento underline-offset-4">{c.nombre}</h3>
                    {c.saldoPendiente > 0 && <Insignia tono="alerta">Debe {pesos(c.saldoPendiente)}</Insignia>}
                  </div>
                  <p className="text-base text-texto-suave">
                    C.C. {c.identificacion} · Tel. {c.telefono}
                  </p>
                  <p className="text-base text-texto-suave">Sector: {c.sector}</p>
                  <p className="mt-2 text-lg">
                    <strong>{c.compras}</strong> {c.compras === 1 ? "compra" : "compras"} · Total <strong>{pesos(c.totalComprado)}</strong>
                  </p>
                  <p className="text-base text-texto-suave">
                    {c.ultimaCompra ? `Última compra: ${fecha(c.ultimaCompra)}` : "Sin compras vigentes"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Paginacion
            etiqueta="Páginas de clientes"
            pagina={datos.pagina}
            totalPaginas={datos.totalPaginas}
            total={datos.total}
            nombres={["clientes", "cliente"]}
            hrefDe={(p) => urlCon({ pagina: p, cliente: null })}
          />
        </>
      )}
    </>
  );
}
