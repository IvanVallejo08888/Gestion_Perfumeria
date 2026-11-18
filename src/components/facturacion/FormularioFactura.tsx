/**
 * Formulario de facturación (sirve para FACTURA NORMAL y para CRÉDITO).
 *
 * Pasos que ve la persona:
 *   1. Datos del cliente.
 *   2. Productos (lista siempre visible, con filtro y control de stock).
 *   · Secciones desplegables: descuento, costo adicional y notas.
 *   3. Medio de pago (factura normal) o cuotas (crédito).
 *   → "Registrar factura": se guarda, se descuenta el inventario y se abre la factura lista para compartir.
 *
 * Si llega "productoInicialId" (botón «Vender» del inventario), ese perfume se carga solo en la factura.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { pesos } from "@/lib/formato";
import { cargarBorradorGuardado, cuotasVigentes, guardarBorradorFactura, reconciliarLineas } from "@/lib/borrador-factura";
import { api, ErrorApi } from "@/lib/http";
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

interface Props {
  tipo: TipoFactura;
  /** Perfume que se carga al abrir (viene de «Vender» en el inventario). */
  productoInicialId?: string | null;
  /** Se llama después de registrar la factura (la página quita el perfume de la URL). */
  onRegistrada?: () => void;
}

export function FormularioFactura({ tipo, productoInicialId, onRegistrada }: Props) {
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
  const [erroresGenerales, setErroresGenerales] = useState<string[]>([]);
  const avisoErrorRef = useRef<HTMLDivElement>(null);
  // Cada vez que aparecen errores, el aviso sube a la vista y recibe el foco (también lo anuncia el lector de pantalla)
  useEffect(() => {
    if (erroresGenerales.length === 0) return;
    avisoErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    avisoErrorRef.current?.focus({ preventScroll: true });
  }, [erroresGenerales]);
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

  /* ------------- Borrador: la factura sin terminar no se pierde al recargar ------------- */
  // Mientras se restaura no se guarda nada (si no, el formulario vacío borraría el borrador)
  const [restaurado, setRestaurado] = useState(false);
  const [recuperado, setRecuperado] = useState<{ productos: number; cambios: string[] } | null>(null);

  useEffect(() => {
    const borrador = cargarBorradorGuardado();
    if (!borrador) {
      setRestaurado(true);
      return;
    }
    let cancelado = false;
    // Igual tipo = se recargó la página. Distinto = se cambió de pestaña: se conservan cliente y productos.
    const mismoTipo = borrador.tipo === tipo;
    const cambios: string[] = [];

    // 1. Lo guardado aparece al instante (así nada de lo que se escriba después se pisa)
    setCliente(borrador.cliente);
    // Si llegó un perfume desde «Vender» del inventario, se conserva
    setLineas((actual) => [...borrador.lineas, ...actual.filter((a) => !borrador.lineas.some((l) => l.producto.id === a.producto.id))]);
    setDescuento(borrador.descuento);
    setAdicional(borrador.adicional);
    setNotas(borrador.notas);
    if (mismoTipo && !esCredito) {
      setMedioPago(borrador.medioPago);
      setTransferencia(borrador.transferencia);
    }
    if (mismoTipo && esCredito) {
      const vigentes = cuotasVigentes(borrador.cuotas);
      if (vigentes) setCuotas(vigentes);
      else if (borrador.cuotas) cambios.push("Algunas fechas de las cuotas ya pasaron: se calcularon de nuevo.");
    }
    if (mismoTipo || cambios.length > 0) setRecuperado({ productos: borrador.lineas.length, cambios });
    setRestaurado(true);

    // 2. Precio y stock salen del servidor; sin conexión se conserva lo guardado (el servidor revisa al registrar)
    if (borrador.lineas.length === 0) return;
    (async () => {
      const respuestas = await Promise.allSettled(
        borrador.lineas.map((l) => api<{ producto: ProductoVenta }>(`/api/productos/${l.producto.id}`)),
      );
      const frescos = new Map<string, ProductoVenta | null>();
      respuestas.forEach((r, i) => {
        const id = borrador.lineas[i].producto.id;
        if (r.status === "fulfilled") frescos.set(id, r.value.producto);
        else if (r.reason instanceof ErrorApi && r.reason.estado === 404) frescos.set(id, null);
      });
      if (cancelado) return;
      const resultado = reconciliarLineas(borrador.lineas, frescos);
      // Se aplica sobre lo que haya en pantalla (la persona pudo cambiar cantidades mientras tanto)
      setLineas((actual) => reconciliarLineas(actual, frescos).lineas);
      if (resultado.cambios.length > 0) {
        setRecuperado((r) => ({
          productos: resultado.lineas.length,
          cambios: [...(r?.cambios ?? cambios), ...resultado.cambios],
        }));
      } else {
        setRecuperado((r) => (r ? { ...r, productos: resultado.lineas.length } : r));
      }
    })();
    return () => {
      cancelado = true;
    };
    // Solo al abrir el formulario (cambiar de pestaña lo vuelve a montar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restaurado) return;
    guardarBorradorFactura({ tipo, cliente, lineas, descuento, adicional, notas, medioPago, transferencia, cuotas });
  }, [restaurado, tipo, cliente, lineas, descuento, adicional, notas, medioPago, transferencia, cuotas]);

  /* --------------- Perfume que llega desde «Vender» del inventario --------------- */
  const cargadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!productoInicialId || cargadoRef.current === productoInicialId) return;
    cargadoRef.current = productoInicialId;
    api<{ producto: ProductoVenta }>(`/api/productos/${productoInicialId}`)
      .then(({ producto }) => {
        if (producto.stock <= 0) {
          avisos.error(`«${producto.nombre}» está agotado. No se puede vender.`);
          return;
        }
        setLineas((actual) => (actual.some((l) => l.producto.id === producto.id) ? actual : [...actual, { producto, cantidad: 1 }]));
        avisos.info(`Agregado desde el inventario: ${producto.nombre}`);
      })
      .catch((e: Error) => avisos.error(e.message));
  }, [productoInicialId, avisos]);

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
    setErroresGenerales([]);
    setErrorCuotas("");
    setRecuperado(null);
    if (esCredito) setCuotas(configInicial());
  }

  /* -------------------------------- Registrar ------------------------------- */
  async function registrar() {
    setErroresGenerales([]);
    setErrorCuotas("");
    setErrorPago("");
    // Se revisan TODOS los pasos y se listan juntos, para que la persona vea de una vez qué falta
    const errores: string[] = [];

    // 1. Cliente
    const validacion = clienteSchema.safeParse(cliente);
    if (!validacion.success) {
      const erroresCampos: Partial<Record<keyof ClienteDatos, string>> = {};
      for (const i of validacion.error.issues) {
        const campo = i.path[0] as keyof ClienteDatos;
        if (!erroresCampos[campo]) erroresCampos[campo] = i.message;
      }
      setErroresCliente(erroresCampos);
      errores.push("Paso 1: hay datos del cliente sin completar o con errores.");
    } else if (!sectores?.some((s) => s.nombre === validacion.data.sector)) {
      // El sector debe ser uno de los activos del local (el servidor lo vuelve a verificar)
      setErroresCliente({ sector: "Elige un sector de la lista." });
      errores.push(consultaSectores.error || "Paso 1: falta elegir el sector.");
    } else {
      setErroresCliente({});
    }

    // 2. Productos y totales
    const productosOk = lineas.length > 0 && total >= 0 && !(esCredito && total <= 0);
    if (lineas.length === 0) errores.push("Paso 2: agrega al menos un producto a la factura.");
    else if (total < 0) errores.push("Paso 2: el descuento no puede ser mayor que el valor de la factura.");
    else if (esCredito && total <= 0) errores.push("Paso 2: un crédito debe tener un valor mayor que cero.");

    // 3. Medio de pago (solo factura normal). Los valores solo se revisan si el total ya es válido.
    if (!esCredito) {
      if (!medioPago) {
        setErrorPago("Elige el medio de pago.");
        errores.push("Paso 3: falta elegir el medio de pago.");
      } else if (productosOk) {
        const { error } = calcularPago(medioPago, total, transferencia);
        if (error) {
          setErrorPago(error);
          errores.push(`Paso 3: ${error}`);
        }
      }
    }

    // 3. Cuotas (deben estar completas y ser fechas futuras)
    let fechasIso: string[] | undefined;
    if (esCredito) {
      const fechas = cuotas?.fechas ?? [];
      if (fechas.length === 0 || fechas.some((f) => !f || Number.isNaN(new Date(f).getTime()))) {
        setErrorCuotas("Completa la fecha y hora de todas las cuotas.");
        errores.push("Paso 3: faltan fechas en las cuotas.");
      } else if (fechas.some((f) => new Date(f).getTime() < Date.now())) {
        setErrorCuotas("Hay cuotas con fecha pasada. Todas las fechas de cobro deben ser futuras.");
        errores.push("Paso 3: revisa las fechas de las cuotas.");
      } else {
        fechasIso = fechas.map((f) => new Date(f).toISOString());
      }
    }

    if (errores.length > 0 || !validacion.success) return setErroresGenerales(errores);

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
      onRegistrada?.();
      // Actualiza el contador de notificaciones (nuevos cobros o stock bajo)
      avisarCambioNotificaciones();
    } catch (err) {
      setErroresGenerales([(err as Error).message]);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      {recuperado && (
        <Mensaje tono="info" titulo="Recuperamos tu factura sin terminar">
          <p>
            {recuperado.productos === 1 ? "Tiene 1 producto." : `Tiene ${recuperado.productos} productos.`} Revisa los datos antes de registrar.
          </p>
          {recuperado.cambios.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {recuperado.cambios.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton variante="secundario" icono="basura" onClick={limpiar}>
              Descartar borrador
            </Boton>
            <Boton variante="fantasma" onClick={() => setRecuperado(null)}>
              Entendido
            </Boton>
          </div>
        </Mensaje>
      )}

      {erroresGenerales.length > 0 && (
        <div ref={avisoErrorRef} tabIndex={-1} className="scroll-mt-20 rounded-xl focus:outline-none">
          <Mensaje tono="peligro" titulo="No se pudo registrar">
            {erroresGenerales.length === 1 ? (
              erroresGenerales[0]
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {erroresGenerales.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </Mensaje>
        </div>
      )}

      <Tarjeta>
        <DatosCliente valor={cliente} onCambio={setCliente} errores={erroresCliente} sectores={sectores} />
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-2xl font-bold">2. Productos</h2>
        <BuscadorProductos onAgregar={agregar} enFactura={enFactura} versionInventario={versionInventario} />

        <div className="mt-6">
          <h3 className="mb-2 text-xl font-bold">Productos en la factura ({lineas.length})</h3>
          {lineas.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-linea-fuerte p-5 text-center text-lg text-texto-suave">
              Todavía no has agregado productos. Usa el botón + de la lista de arriba.
            </p>
          ) : (
            <ul className="space-y-3">
              {lineas.map((l) => (
                <li key={l.producto.id} className="grid gap-3 rounded-xl border-2 border-linea p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
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
                      className="flex size-12 items-center justify-center rounded-xl border-2 border-borde bg-tarjeta disabled:opacity-40"
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
                      className="flex size-12 items-center justify-center rounded-xl border-2 border-borde bg-tarjeta disabled:opacity-40"
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
                      className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-base font-bold text-peligro-800 hover:bg-peligro-50"
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
          <div className={`flex justify-between border-t-2 pt-2 text-3xl font-bold ${total < 0 ? "text-peligro-800" : "text-acento"}`}>
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
