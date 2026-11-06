/**
 * Formulario de facturación (sirve para FACTURA NORMAL y para CRÉDITO).
 *
 * Pasos que ve la persona:
 *   1. Datos del cliente.
 *   2. Productos (lista siempre visible, con filtro y control de stock).
 *   · Secciones desplegables: descuento, costo adicional y notas.
 *   3. Medio de pago (factura normal) o cuotas (crédito).
 *   → "Registrar factura": se guarda, se descuenta el inventario y se abre la factura lista para compartir.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { calcularPago } from "@/lib/pagos";
import { clienteSchema } from "@/lib/validaciones";
import type { ClienteDatos, FacturaDetalle, MedioPago, NombreActivo, ProductoVenta, TipoFactura } from "@/tipos";
import { Mensaje, Tarjeta } from "../ui/Basicos";
import { Boton } from "../ui/Boton";
import { CampoDinero } from "../ui/Campo";
import { Desplegable } from "../ui/Desplegable";
import { Icono } from "../ui/Icono";
import { Modal } from "../ui/Modal";
import { useAvisos } from "../ui/Avisos";
import { BuscadorProductos } from "./BuscadorProductos";
import { CLIENTE_VACIO, DatosCliente } from "./DatosCliente";
import { configInicial, EditorCuotas, type ConfigCuotas } from "./EditorCuotas";
import { SelectorMedioPago } from "./MedioPago";
import { VistaFactura } from "./VistaFactura";

interface Linea {
  producto: ProductoVenta;
  cantidad: number;
}

export function FormularioFactura({ tipo }: { tipo: TipoFactura }) {
  const avisos = useAvisos();
  const esCredito = tipo === "CREDITO";

  const [cliente, setCliente] = useState<ClienteDatos>(CLIENTE_VACIO);
  const [erroresCliente, setErroresCliente] = useState<Partial<Record<keyof ClienteDatos, string>>>({});
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [adicional, setAdicional] = useState(0);
  const [descuento, setDescuento] = useState(0);
  const [notas, setNotas] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | null>(null);
  const [transferencia, setTransferencia] = useState(0);
  const [errorPago, setErrorPago] = useState("");
  // Las fechas se crean en el navegador (para usar la hora local del dispositivo)
  const [cuotas, setCuotas] = useState<ConfigCuotas | null>(null);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [errorCuotas, setErrorCuotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [facturaCreada, setFacturaCreada] = useState<FacturaDetalle | null>(null);
  // Aumenta con cada factura registrada para que la lista de productos recargue el stock
  const [versionInventario, setVersionInventario] = useState(0);

  const consultaSectores = useConsulta<{ sectores: NombreActivo[] }>("/api/sectores");
  const sectores = consultaSectores.datos?.sectores ?? null;
  const sinSectores = sectores?.length === 0;

  useEffect(() => {
    if (esCredito) setCuotas(configInicial());
  }, [esCredito]);

  /* ------------------------------- Totales ------------------------------- */
  const subtotal = useMemo(() => lineas.reduce((acc, l) => acc + l.producto.precio * l.cantidad, 0), [lineas]);
  const total = subtotal + adicional - descuento;
  const enFactura = useMemo(() => Object.fromEntries(lineas.map((l) => [l.producto.id, l.cantidad])), [lineas]);

  /* ------------------------------- Productos ------------------------------ */
  function agregar(producto: ProductoVenta): string | null {
    const existente = lineas.find((l) => l.producto.id === producto.id);
    if (existente) {
      if (existente.cantidad + 1 > producto.stock) {
        return `Solo hay ${producto.stock} unidades de «${producto.nombre}» y ya están todas en la factura.`;
      }
      setLineas(lineas.map((l) => (l.producto.id === producto.id ? { producto, cantidad: l.cantidad + 1 } : l)));
    } else {
      setLineas([...lineas, { producto, cantidad: 1 }]);
    }
    avisos.info(`Agregado: ${producto.nombre}`);
    return null;
  }

  function cambiarCantidad(id: string, cantidad: number) {
    setLineas((actual) =>
      actual.map((l) => {
        if (l.producto.id !== id) return l;
        if (cantidad > l.producto.stock) {
          avisos.error(`Solo hay ${l.producto.stock} unidades de «${l.producto.nombre}».`);
          return { ...l, cantidad: l.producto.stock };
        }
        return { ...l, cantidad: Math.max(1, cantidad) };
      }),
    );
  }

  const quitar = (id: string) => setLineas((actual) => actual.filter((l) => l.producto.id !== id));

  function limpiar() {
    setCliente(CLIENTE_VACIO);
    setLineas([]);
    setAdicional(0);
    setDescuento(0);
    setNotas("");
    setMedioPago(null);
    setTransferencia(0);
    setErrorPago("");
    setErroresCliente({});
    setErrorGeneral("");
    setErrorCuotas("");
    if (esCredito) setCuotas(configInicial());
  }

  /* -------------------------------- Registrar ------------------------------- */
  async function registrar() {
    setErrorGeneral("");
    setErrorCuotas("");
    setErrorPago("");

    // 1. Cliente
    const validacion = clienteSchema.safeParse(cliente);
    if (!validacion.success) {
      const errores: Partial<Record<keyof ClienteDatos, string>> = {};
      for (const i of validacion.error.issues) {
        const campo = i.path[0] as keyof ClienteDatos;
        if (!errores[campo]) errores[campo] = i.message;
      }
      setErroresCliente(errores);
      setErrorGeneral("Revisa los datos del cliente: hay campos sin completar o con errores.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // El sector debe ser uno de los activos del local (el servidor lo vuelve a verificar)
    if (!sectores?.some((s) => s.nombre === validacion.data.sector)) {
      setErroresCliente({ sector: "Elige un sector de la lista." });
      setErrorGeneral(consultaSectores.error || "Revisa los datos del cliente: falta el sector.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErroresCliente({});

    // 2. Productos y totales
    if (lineas.length === 0) return setErrorGeneral("Agrega al menos un producto a la factura.");
    if (total < 0) return setErrorGeneral("El descuento no puede ser mayor que el valor de la factura.");
    if (esCredito && total <= 0) return setErrorGeneral("Un crédito debe tener un valor mayor que cero.");

    // 3. Medio de pago (solo factura normal)
    if (!esCredito) {
      if (!medioPago) {
        setErrorPago("Elige el medio de pago.");
        return setErrorGeneral("Falta elegir el medio de pago.");
      }
      const { error } = calcularPago(medioPago, total, transferencia);
      if (error) {
        setErrorPago(error);
        return setErrorGeneral(error);
      }
    }

    // 4. Cuotas (deben estar completas y ser fechas futuras)
    let fechasIso: string[] | undefined;
    if (esCredito) {
      const fechas = cuotas?.fechas ?? [];
      if (fechas.length === 0 || fechas.some((f) => !f || Number.isNaN(new Date(f).getTime()))) {
        setErrorCuotas("Completa la fecha y hora de todas las cuotas.");
        return setErrorGeneral("Faltan fechas en las cuotas.");
      }
      if (fechas.some((f) => new Date(f).getTime() < Date.now())) {
        setErrorCuotas("Hay cuotas con fecha pasada. Todas las fechas de cobro deben ser futuras.");
        return setErrorGeneral("Revisa las fechas de las cuotas.");
      }
      fechasIso = fechas.map((f) => new Date(f).toISOString());
    }

    setGuardando(true);
    try {
      const { factura } = await api<{ factura: FacturaDetalle }>("/api/facturas", {
        method: "POST",
        json: {
          tipo,
          cliente: validacion.data,
          items: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
          adicional,
          descuento,
          notas: notas.trim() || undefined,
          cuotas: fechasIso?.map((fechaVencimiento) => ({ fechaVencimiento })),
          ...(esCredito ? {} : { medioPago }),
          // En Mixto se envían los dos valores: el servidor los compara con el total que él calcula
          ...(!esCredito && medioPago === "MIXTO" ? { valorTransferencia: transferencia, valorEfectivo: total - transferencia } : {}),
        },
      });
      setFacturaCreada(factura);
      avisos.exito(esCredito ? "Crédito registrado correctamente." : "Factura registrada correctamente.");
      limpiar();
      setVersionInventario((v) => v + 1);
      // Actualiza el contador de notificaciones (nuevos cobros o stock bajo)
      avisarCambioNotificaciones();
    } catch (err) {
      setErrorGeneral((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      {errorGeneral && <Mensaje tono="peligro" titulo="No se pudo registrar">{errorGeneral}</Mensaje>}

      <Tarjeta>
        <DatosCliente valor={cliente} onCambio={setCliente} errores={erroresCliente} sectores={sectores} />
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-2xl font-bold">2. Productos</h2>
        <BuscadorProductos onAgregar={agregar} enFactura={enFactura} versionInventario={versionInventario} />

        <div className="mt-6">
          <h3 className="mb-2 text-xl font-bold">Productos en la factura ({lineas.length})</h3>
          {lineas.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-gray-300 p-5 text-center text-lg text-texto-suave">
              Todavía no has agregado productos. Usa el botón + de la lista de arriba.
            </p>
          ) : (
            <ul className="space-y-3">
              {lineas.map((l) => (
                <li key={l.producto.id} className="grid gap-3 rounded-xl border-2 border-gray-200 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="text-lg font-bold">{l.producto.nombre}</p>
                    <p className="text-base text-texto-suave">
                      {pesos(l.producto.precio)} c/u · Disponibles: {l.producto.stock}
                    </p>
                  </div>
                  {/* Control de cantidad con botones grandes */}
                  <div className="flex items-center gap-2" role="group" aria-label={`Cantidad de ${l.producto.nombre}`}>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(l.producto.id, l.cantidad - 1)}
                      disabled={l.cantidad <= 1}
                      className="flex size-12 items-center justify-center rounded-xl border-2 border-borde bg-white disabled:opacity-40"
                      aria-label="Quitar una unidad"
                    >
                      <Icono nombre="menos" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={l.producto.stock}
                      value={l.cantidad}
                      onChange={(e) => cambiarCantidad(l.producto.id, Number(e.target.value) || 1)}
                      className="h-12 w-20 rounded-xl border-2 border-borde text-center text-xl font-bold"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(l.producto.id, l.cantidad + 1)}
                      disabled={l.cantidad >= l.producto.stock}
                      className="flex size-12 items-center justify-center rounded-xl border-2 border-borde bg-white disabled:opacity-40"
                      aria-label="Agregar una unidad"
                    >
                      <Icono nombre="mas" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-xl font-bold">{pesos(l.producto.precio * l.cantidad)}</p>
                    <button
                      type="button"
                      onClick={() => quitar(l.producto.id)}
                      className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-base font-bold text-peligro-700 hover:bg-peligro-50"
                    >
                      <Icono nombre="basura" className="size-5" />
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tarjeta>

      {/* Secciones opcionales: empiezan cerradas, pero su valor se ve en el encabezado */}
      <Desplegable titulo="Aplicar descuento" resumen={descuento > 0 ? `− ${pesos(descuento)}` : undefined}>
        <CampoDinero etiqueta="Valor del descuento" valor={descuento} onCambio={setDescuento} ayuda="Valor fijo que se RESTA del total." />
      </Desplegable>

      <Desplegable titulo="Costo adicional" resumen={adicional > 0 ? `+ ${pesos(adicional)}` : undefined}>
        <CampoDinero etiqueta="Valor del costo adicional (ej. domicilio)" valor={adicional} onCambio={setAdicional} ayuda="Valor fijo que se SUMA al total." />
      </Desplegable>

      <Desplegable titulo="Notas (opcional)" resumen={notas.trim() ? "Con nota" : undefined}>
        <label htmlFor="notas-factura" className="mb-1.5 block text-lg font-bold">
          Notas de la factura
        </label>
        <textarea
          id="notas-factura"
          rows={2}
          maxLength={300}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="block w-full rounded-xl border-2 border-borde px-4 py-2.5 text-lg focus:border-marca-700 focus:outline-none focus:ring-4 focus:ring-marca-200"
        />
      </Desplegable>

      {!esCredito && (
        <Tarjeta>
          <h2 className="mb-3 text-2xl font-bold">3. Medio de pago</h2>
          <SelectorMedioPago
            titulo="¿Cómo paga el cliente?"
            total={Math.max(0, total)}
            medio={medioPago}
            onMedio={(m) => {
              setMedioPago(m);
              setErrorPago("");
            }}
            transferencia={transferencia}
            onTransferencia={setTransferencia}
            error={errorPago}
          />
        </Tarjeta>
      )}

      {esCredito && cuotas && (
        <Tarjeta>
          <EditorCuotas config={cuotas} onCambio={setCuotas} total={Math.max(0, total)} error={errorCuotas} />
        </Tarjeta>
      )}

      {/* Resumen fijo y botón de registrar */}
      <Tarjeta className="border-marca-700">
        <h2 className="sr-only">Resumen de la factura</h2>
        <dl className="space-y-1 text-lg">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{pesos(subtotal)}</dd></div>
          {adicional > 0 && <div className="flex justify-between"><dt>Costo adicional</dt><dd>+ {pesos(adicional)}</dd></div>}
          {descuento > 0 && <div className="flex justify-between"><dt>Descuento</dt><dd>− {pesos(descuento)}</dd></div>}
          <div className={`flex justify-between border-t-2 pt-2 text-3xl font-bold ${total < 0 ? "text-peligro-700" : "text-marca-800"}`}>
            <dt>Total</dt>
            <dd aria-live="polite">{pesos(total)}</dd>
          </div>
        </dl>
        {sinSectores && (
          <div className="mt-4">
            <Mensaje tono="alerta">El administrador aún no ha agregado sectores para este local</Mensaje>
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton variante="secundario" icono="basura" onClick={limpiar} disabled={guardando}>
            Limpiar todo
          </Boton>
          <Boton onClick={registrar} cargando={guardando} disabled={sinSectores} icono="check" className="sm:min-w-72">
            {esCredito ? "Registrar crédito" : "Registrar factura"}
          </Boton>
        </div>
      </Tarjeta>

      {/* La factura se abre lista para compartir */}
      <Modal
        abierto={facturaCreada !== null}
        onCerrar={() => setFacturaCreada(null)}
        titulo={facturaCreada ? `Factura de ${facturaCreada.clienteNombre}` : "Factura"}
        tamano="xl"
      >
        {facturaCreada && <VistaFactura factura={facturaCreada} />}
      </Modal>
    </div>
  );
}
