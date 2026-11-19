/**
 * Limpieza del sistema (solo administrador). BORRA DATOS DE FORMA DEFINITIVA.
 *  - Paso 1: elegir el local. Hasta entonces no se muestra nada más.
 *  - Resumen de lo que el local tiene hoy.
 *  - Limpieza por periodo: ventas de contado y gastos de los meses elegidos, con vista previa obligatoria.
 *  - Zona de peligro: borrar por categoría (ventas, créditos, gastos, clientes, inventario o todo el local).
 *  - Toda limpieza pasa por ConfirmarLimpieza (respaldo, "BORRAR <LOCAL>", contraseña y cuenta regresiva).
 *  - Historial de limpiezas (no se puede borrar).
 */
"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/Avisos";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { useConsulta } from "@/hooks/useConsulta";
import { anioMesColombia, fecha, fechaHora, MESES, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { describirConteos, describirPeriodo, hayAlgoQueBorrar, type AlcanceLimpieza, type ConteosLimpieza } from "@/lib/limpieza";
import { ConfirmarLimpieza, lineasConteos, type ResultadoLimpieza, type SolicitudUI } from "./ConfirmarLimpieza";

interface Resumen {
  local: { id: string; nombre: string; activo: boolean; consecutivoFactura: number };
  ventasContado: number;
  creditosPendientes: number;
  creditosCompletados: number;
  abonos: number;
  clientes: number;
  clientesConFacturas: number;
  productos: number;
  gastos: number;
  primeraVenta: string | null;
  ultimaVenta: string | null;
}

interface FilaHistorial {
  id: string;
  localNombre: string;
  adminNombre: string;
  descripcion: string;
  conteos: ConteosLimpieza;
  valorTotal: number;
  reinicioConsecutivo: boolean;
  creadoEn: string;
}

const HOY = anioMesColombia(new Date());
const ANIOS = Array.from({ length: 6 }, (_, i) => HOY.anio - i);

export default function PaginaLimpieza() {
  const avisos = useAvisos();
  const [localId, setLocalId] = useState("");
  const [confirmando, setConfirmando] = useState<SolicitudUI | null>(null);

  const consultaLocales = useConsulta<{ locales: { id: string; nombre: string; activo: boolean }[] }>("/api/admin/locales");
  const locales = consultaLocales.datos?.locales ?? null;
  const consultaResumen = useConsulta<Resumen>(localId ? `/api/admin/limpieza/resumen?localId=${localId}` : null);
  const resumen = consultaResumen.urlDatos === `/api/admin/limpieza/resumen?localId=${localId}` ? consultaResumen.datos : null;
  const consultaHistorial = useConsulta<{ limpiezas: FilaHistorial[] }>(localId ? `/api/admin/limpieza/historial?localId=${localId}` : null);
  /** Cambia después de cada limpieza: reinicia la vista previa del periodo. */
  const [version, setVersion] = useState(0);

  function alTerminar(r: ResultadoLimpieza) {
    setConfirmando(null);
    avisos.exito(
      `Limpieza completada: se borraron ${describirConteos(r.conteos)}${r.reinicioConsecutivo ? ". La numeración de facturas vuelve a empezar en 1" : ""}.`,
    );
    consultaResumen.recargar();
    consultaHistorial.recargar();
    setVersion((v) => v + 1);
  }

  return (
    <>
      {/*
       * Aviso fijo arriba de todo de la pantalla (siempre lo primero que se ve). No sigue el desplazamiento
       * para no quedar tapado por la barra superior; la ventana de confirmación repite la advertencia en rojo.
       */}
      <div role="alert" className="mb-6 rounded-xl border-2 border-peligro-700 bg-peligro-700 px-4 py-3 text-lg font-bold text-white shadow-lg">
        <p className="flex items-start gap-2">
          <Icono nombre="alerta" className="mt-0.5 size-7" />
          <span>⚠ Lo que borres aquí NO se puede recuperar. Antes de borrar se descargará automáticamente una copia de respaldo.</span>
        </p>
      </div>

      <EncabezadoPagina titulo="Limpieza del sistema" descripcion="Borra datos antiguos de un local. Usa esta opción con mucho cuidado." />

      <Tarjeta className="mb-6">
        <Selector etiqueta="Paso 1: elige el local" value={localId} onChange={(e) => setLocalId(e.target.value)} disabled={!locales}>
          <option value="">{locales ? "Elige un local" : "Cargando locales…"}</option>
          {locales?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
              {l.activo ? "" : " (desactivado)"}
            </option>
          ))}
        </Selector>
        {consultaLocales.error && (
          <div className="mt-3">
            <Mensaje tono="peligro">{consultaLocales.error}</Mensaje>
          </div>
        )}
      </Tarjeta>

      {!localId ? null : consultaResumen.error ? (
        <Mensaje tono="peligro">{consultaResumen.error}</Mensaje>
      ) : !resumen ? (
        <Cargando texto="Cargando el resumen del local…" />
      ) : (
        <div className="space-y-8">
          <ResumenLocal r={resumen} />
          <LimpiezaPeriodo key={`${localId}-${version}`} localId={localId} localNombre={resumen.local.nombre} onBorrar={setConfirmando} />
          <ZonaPeligro r={resumen} onBorrar={setConfirmando} />
          <Historial filas={consultaHistorial.datos?.limpiezas ?? null} error={consultaHistorial.error} />
        </div>
      )}

      {confirmando && resumen && (
        <ConfirmarLimpieza solicitud={confirmando} localNombre={resumen.local.nombre} onCerrar={() => setConfirmando(null)} onListo={alTerminar} />
      )}
    </>
  );
}

/* ------------------------------- Resumen ------------------------------- */

function ResumenLocal({ r }: { r: Resumen }) {
  const datos = [
    { titulo: "Ventas de contado", valor: r.ventasContado },
    { titulo: "Créditos pendientes", valor: r.creditosPendientes },
    { titulo: "Créditos completados o anulados", valor: r.creditosCompletados },
    { titulo: "Abonos", valor: r.abonos },
    { titulo: "Clientes", valor: r.clientes },
    { titulo: "Productos", valor: r.productos },
    { titulo: "Gastos", valor: r.gastos },
  ];
  return (
    <section aria-labelledby="titulo-resumen">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="titulo-resumen" className="text-2xl font-bold">
          Lo que tiene hoy «{r.local.nombre}»
        </h2>
        {!r.local.activo && <Insignia tono="alerta">Local desactivado</Insignia>}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {datos.map((d) => (
          <li key={d.titulo} className="rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm">
            <p className="text-base font-bold text-texto-suave">{d.titulo}</p>
            <p className="text-3xl font-bold text-acento">{d.valor}</p>
          </li>
        ))}
        <li className="col-span-2 rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm sm:col-span-1 lg:col-span-1">
          <p className="text-base font-bold text-texto-suave">Primera y última venta</p>
          <p className="text-lg font-bold">{r.primeraVenta ? `${fecha(r.primeraVenta)} — ${fecha(r.ultimaVenta!)}` : "Sin ventas"}</p>
        </li>
      </ul>
    </section>
  );
}

/* --------------------------- Limpieza por periodo --------------------------- */

function LimpiezaPeriodo({ localId, localNombre, onBorrar }: { localId: string; localNombre: string; onBorrar: (s: SolicitudUI) => void }) {
  const avisos = useAvisos();
  const [anio, setAnio] = useState(HOY.anio);
  const [meses, setMeses] = useState<number[]>([]);
  const [todoElAnio, setTodoElAnio] = useState(false);
  const [previa, setPrevia] = useState<{ clave: string; conteos: ConteosLimpieza } | null>(null);
  const [cargando, setCargando] = useState(false);

  /** Un mes es futuro si todavía no ha empezado (el mes actual sí se permite). */
  const esFuturo = (m: number) => anio > HOY.anio || (anio === HOY.anio && m > HOY.mes);
  const mesesElegidos = todoElAnio ? [] : meses;
  const periodoListo = todoElAnio || meses.length > 0;
  // La vista previa solo vale para los filtros con los que se pidió
  const clave = `${anio}|${todoElAnio ? "todo" : meses.join(",")}`;
  const previaVigente = previa?.clave === clave ? previa.conteos : null;
  const lineas = previaVigente ? lineasConteos(previaVigente) : null;

  function alternarMes(m: number) {
    setTodoElAnio(false);
    setMeses((lista) => (lista.includes(m) ? lista.filter((x) => x !== m) : [...lista, m].sort((a, b) => a - b)));
  }

  async function verPrevia() {
    setCargando(true);
    try {
      const r = await api<{ conteos: ConteosLimpieza }>("/api/admin/limpieza/previa", {
        method: "POST",
        json: { localId, alcance: "PERIODO", anio, meses: mesesElegidos },
      });
      setPrevia({ clave, conteos: r.conteos });
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-2xl font-bold">Borrar ventas de contado y gastos de un periodo</h2>
      <p className="mt-1 text-lg text-texto-suave">
        Solo borra las <strong>ventas de contado</strong> (también las anuladas) y los <strong>gastos</strong> de los meses que elijas. Se conservan los
        clientes, el inventario (el stock no cambia) y <strong>todos los créditos</strong> con sus cuotas y abonos.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-[14rem_1fr]">
        <Selector etiqueta="Año" value={anio} onChange={(e) => (setAnio(Number(e.target.value)), setMeses([]), setTodoElAnio(false))}>
          {ANIOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selector>
        <fieldset>
          <legend className="mb-1.5 text-lg font-bold">Meses</legend>
          <label className="mb-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-borde bg-tarjeta px-3 text-lg font-bold has-[:checked]:border-marca-700 has-[:checked]:bg-marca-50">
            <input
              type="checkbox"
              className="size-6 accent-marca-700"
              checked={todoElAnio}
              disabled={anio > HOY.anio}
              onChange={(e) => (setTodoElAnio(e.target.checked), setMeses([]))}
            />
            Todo el año {anio}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
            {MESES.map((nombre, i) => {
              const m = i + 1;
              const futuro = esFuturo(m);
              return (
                <label
                  key={nombre}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-lg ${
                    futuro ? "cursor-not-allowed border-linea text-texto-tenue" : "cursor-pointer border-borde bg-tarjeta has-[:checked]:border-marca-700 has-[:checked]:bg-marca-50 has-[:checked]:font-bold"
                  }`}
                >
                  <input type="checkbox" className="size-6 shrink-0 accent-marca-700" checked={todoElAnio || meses.includes(m)} disabled={futuro || todoElAnio} onChange={() => alternarMes(m)} />
                  {nombre}
                  {futuro && <span className="sr-only"> (todavía no ha llegado)</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-base text-texto-suave">Los meses que todavía no han llegado no se pueden elegir.</p>
        </fieldset>
      </div>

      <div className="mt-5">
        <Boton variante="secundario" icono="ojo" disabled={!periodoListo} cargando={cargando} onClick={verPrevia}>
          Ver qué se va a borrar
        </Boton>
      </div>

      {previaVigente && lineas && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <h3 className="text-xl font-bold">Vista previa · {describirPeriodo(anio, mesesElegidos)}</h3>
          {!hayAlgoQueBorrar(previaVigente) ? (
            <Mensaje tono="info" titulo="No hay nada que borrar en ese periodo">
              No hay ventas de contado ni gastos en esos meses.
            </Mensaje>
          ) : (
            <>
              <div className="rounded-xl border-2 border-peligro-700 bg-peligro-50 p-4 text-lg text-peligro-800">
                <p className="font-bold">Se borrará:</p>
                <ul className="mt-1 list-disc pl-6">
                  {lineas.borrar.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-2 border-exito-700 bg-exito-50 p-4 text-lg text-exito-800">
                <p className="font-bold">No se toca:</p>
                <ul className="mt-1 list-disc pl-6">
                  <li>
                    {previaVigente.conservados.creditos} créditos y {previaVigente.conservados.abonos} abonos de ese periodo
                  </li>
                  <li>Todos los clientes y todo el inventario</li>
                </ul>
              </div>
              <Boton
                variante="peligro"
                icono="basura"
                onClick={() =>
                  onBorrar({ localId, alcance: "PERIODO", anio, meses: mesesElegidos, titulo: `Borrar ventas y gastos de ${describirPeriodo(anio, mesesElegidos)}` })
                }
                aria-label={`Borrar ventas y gastos del periodo en ${localNombre}`}
              >
                Borrar ventas y gastos del periodo
              </Boton>
            </>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

/* ------------------------------- Zona de peligro ------------------------------- */

function ZonaPeligro({ r, onBorrar }: { r: Resumen; onBorrar: (s: SolicitudUI) => void }) {
  const clientesSinFacturas = r.clientes - r.clientesConFacturas;
  const creditos = r.creditosPendientes + r.creditosCompletados;
  const todo = r.ventasContado + creditos + r.gastos + r.clientes + r.productos;

  const tarjetas: { alcance: AlcanceLimpieza; titulo: string; descripcion: string; cantidad: number; nombre: string; boton: string; extra?: string }[] = [
    {
      alcance: "VENTAS",
      titulo: "Borrar todas las ventas de contado",
      descripcion: "Facturas de contado y sus productos vendidos. No toca los créditos, los clientes ni el inventario.",
      cantidad: r.ventasContado,
      nombre: "ventas de contado",
      boton: "Borrar todas las ventas",
    },
    {
      alcance: "CREDITOS",
      titulo: "Borrar todos los créditos",
      descripcion: "Créditos con sus cuotas y abonos. Se pierde lo que falta por cobrar.",
      cantidad: creditos,
      nombre: "créditos",
      boton: "Borrar todos los créditos",
      extra: r.creditosPendientes ? `${r.creditosPendientes} créditos todavía tienen saldo pendiente.` : undefined,
    },
    { alcance: "GASTOS", titulo: "Borrar todos los gastos", descripcion: "Todos los gastos del local, también los eliminados.", cantidad: r.gastos, nombre: "gastos", boton: "Borrar todos los gastos" },
    {
      alcance: "CLIENTES",
      titulo: "Borrar los clientes",
      descripcion: "Solo se pueden borrar los clientes que NO tienen ventas ni créditos.",
      cantidad: clientesSinFacturas,
      nombre: "clientes sin ventas",
      boton: `Borrar los ${clientesSinFacturas} clientes sin ventas`,
      extra: r.clientesConFacturas
        ? `${r.clientesConFacturas} clientes tienen ventas o créditos. Primero borra las ventas y los créditos, o se conservarán esos clientes.`
        : undefined,
    },
    {
      alcance: "INVENTARIO",
      titulo: "Borrar todo el inventario",
      descripcion: "Todos los productos y su historial de movimientos. Las facturas conservan el nombre del producto: el historial de ventas no se daña.",
      cantidad: r.productos,
      nombre: "productos",
      boton: "Borrar todo el inventario",
    },
    {
      alcance: "TODO",
      titulo: "Borrar TODO el local",
      descripcion:
        "Ventas, créditos (con cuotas y abonos), gastos, clientes e inventario. NO borra el local, sus usuarios, sectores, marcas, categorías, proveedores ni compras a proveedores.",
      cantidad: todo,
      nombre: "registros",
      boton: "Borrar TODO el local",
    },
  ];

  return (
    <section aria-labelledby="titulo-peligro" className="rounded-2xl border-2 border-peligro-700 p-3 sm:p-5">
      <h2 id="titulo-peligro" className="flex items-center gap-2 text-2xl font-bold text-peligro-700">
        <Icono nombre="alerta" className="size-8" />
        Zona de peligro
      </h2>
      <p className="mt-1 text-lg">Cada opción borra TODOS los registros de ese tipo en «{r.local.nombre}», sin importar la fecha.</p>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {tarjetas.map((t) => (
          <li key={t.alcance} className="flex flex-col rounded-2xl border-2 border-peligro-700 bg-tarjeta p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-xl font-bold text-peligro-700">
              <Icono nombre="alerta" className="size-6" />
              {t.titulo}
            </h3>
            <p className="mt-1 text-lg">{t.descripcion}</p>
            <p className="mt-2 text-lg">
              Hoy hay <strong>{t.cantidad}</strong> {t.nombre}.
            </p>
            {t.extra && (
              <p className="mt-2 rounded-xl bg-alerta-50 p-3 text-base font-bold text-alerta-800">
                {t.extra}
              </p>
            )}
            <div className="mt-auto pt-4">
              <Boton
                variante="peligro"
                icono="basura"
                ancho
                disabled={t.cantidad === 0}
                onClick={() => onBorrar({ localId: r.local.id, alcance: t.alcance, titulo: t.titulo })}
              >
                {t.cantidad === 0 ? `No hay ${t.nombre} para borrar` : t.boton}
              </Boton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- Historial ------------------------------- */

function Historial({ filas, error }: { filas: FilaHistorial[] | null; error: string }) {
  return (
    <section aria-labelledby="titulo-historial">
      <h2 id="titulo-historial" className="mb-1 text-2xl font-bold">
        Historial de limpiezas
      </h2>
      <p className="mb-3 text-lg text-texto-suave">Queda el registro de cada limpieza: quién, cuándo y qué se borró. Este historial no se puede borrar.</p>
      {error ? (
        <Mensaje tono="peligro">{error}</Mensaje>
      ) : !filas ? (
        <Cargando />
      ) : filas.length === 0 ? (
        <Vacio icono="historial" titulo="Este local no tiene limpiezas registradas" />
      ) : (
        <ul className="space-y-3">
          {filas.map((f) => (
            <li key={f.id} className="rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-lg font-bold">{f.descripcion}</p>
                <p className="text-base text-texto-suave">{fechaHora(f.creadoEn)}</p>
              </div>
              <p className="text-base text-texto-suave">Por {f.adminNombre}</p>
              <p className="mt-1 text-lg">
                Se borraron {describirConteos(f.conteos)}
                {f.valorTotal ? ` · ${pesos(f.valorTotal)}` : ""}
                {f.reinicioConsecutivo ? " · Numeración reiniciada" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
