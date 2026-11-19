/**
 * Pestaña «Proveedores» del Inventario (vendedor):
 *  - Lista de proveedores del local con lo que se les debe (cuentas por pagar).
 *  - Alta y edición: nombre, contacto, teléfono y productos que surte (o desactivarlo).
 *  - Ficha del proveedor: cuánto se le debe, compras (pendientes / saldadas) e historial de abonos.
 *  - Abonar a una compra a crédito (misma forma de pago que los abonos de clientes, con Mixto).
 * Las compras se registran desde «Agregar unidades» de cada perfume.
 */
"use client";

import { useState, type FormEvent } from "react";
import { SelectorMedioPago } from "@/components/facturacion/MedioPago";
import { Cargando, Dato, Insignia, Mensaje, Vacio } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero } from "@/components/ui/Campo";
import { useAvisos } from "@/components/ui/Avisos";
import { Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import { textoEstadoCuenta, textoMedioPagoCompra } from "@/lib/cuentas-por-pagar";
import { fechaDia, fechaHora, hoyColombia, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { calcularPago, textoMedioPago } from "@/lib/pagos";
import { proveedorSchema } from "@/lib/validaciones";
import type { CompraProveedor, MedioPago, Proveedor, ProveedorDetalle } from "@/tipos";

type Accion = { tipo: "nuevo" } | { tipo: "editar"; proveedor: Proveedor } | { tipo: "ficha"; id: string };

export function GestionProveedores() {
  const avisos = useAvisos();
  const consulta = useConsulta<{ proveedores: Proveedor[] }>("/api/proveedores", { alError: avisos.error });
  const lista = consulta.datos?.proveedores ?? (consulta.error ? [] : null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const deudaTotal = lista?.reduce((acc, p) => acc + p.deuda, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          <p className="text-lg text-texto-suave">Total que se les debe a los proveedores</p>
          <p className={`text-3xl font-bold ${deudaTotal > 0 ? "text-peligro-800" : "text-acento"}`}>{pesos(deudaTotal)}</p>
        </div>
        <Boton icono="mas" onClick={() => setAccion({ tipo: "nuevo" })}>
          Agregar proveedor
        </Boton>
      </div>

      {!lista ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio icono="local" titulo="Aún no hay proveedores">
          Presiona «Agregar proveedor» para registrar el primero.
        </Vacio>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-tarjeta p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-xl font-bold">{p.nombre}</h3>
                <div className="flex flex-wrap gap-2">
                  {!p.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                  {p.deuda > 0 ? (
                    <Insignia tono="peligro">Se le debe {pesos(p.deuda)}</Insignia>
                  ) : (
                    <Insignia tono="exito">Al día</Insignia>
                  )}
                </div>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <Dato etiqueta="Contacto">{p.contacto ?? "—"}</Dato>
                <Dato etiqueta="Teléfono">{p.telefono ?? "—"}</Dato>
                <div className="sm:col-span-2">
                  <Dato etiqueta="Productos que surte">{p.productosSurte ?? "—"}</Dato>
                </div>
              </dl>
              <div className="mt-auto grid gap-2 sm:grid-cols-2">
                <Boton icono="historial" onClick={() => setAccion({ tipo: "ficha", id: p.id })}>
                  Ver ficha y abonos
                </Boton>
                <Boton variante="secundario" icono="editar" onClick={() => setAccion({ tipo: "editar", proveedor: p })}>
                  Editar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(accion?.tipo === "nuevo" || accion?.tipo === "editar") && (
        <ModalProveedor
          proveedor={accion.tipo === "editar" ? accion.proveedor : null}
          onCerrar={() => setAccion(null)}
          onListo={(mensaje) => {
            avisos.exito(mensaje);
            setAccion(null);
            consulta.recargar();
          }}
        />
      )}
      {accion?.tipo === "ficha" && <FichaProveedor id={accion.id} onCerrar={() => setAccion(null)} onCambio={consulta.recargar} />}
    </div>
  );
}

/* ------------------------------ Alta y edición ------------------------------ */

type Errores = Partial<Record<"nombre" | "contacto" | "telefono" | "productosSurte", string>>;

function ModalProveedor({ proveedor, onCerrar, onListo }: { proveedor: Proveedor | null; onCerrar: () => void; onListo: (mensaje: string) => void }) {
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? "",
    contacto: proveedor?.contacto ?? "",
    telefono: proveedor?.telefono ?? "",
    productosSurte: proveedor?.productosSurte ?? "",
    activo: proveedor?.activo ?? true,
  });
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const validacion = proveedorSchema.safeParse(form);
    if (!validacion.success) {
      const nuevos: Errores = {};
      for (const i of validacion.error.issues) nuevos[String(i.path[0]) as keyof Errores] ??= i.message;
      return setErrores(nuevos);
    }
    setErrores({});
    setError("");
    setCargando(true);
    try {
      await api(proveedor ? `/api/proveedores/${proveedor.id}` : "/api/proveedores", {
        method: proveedor ? "PUT" : "POST",
        json: validacion.data,
      });
      onListo(proveedor ? `Se guardaron los cambios de «${validacion.data.nombre}».` : `Proveedor «${validacion.data.nombre}» agregado.`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={proveedor ? "Editar proveedor" : "Agregar proveedor"}>
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <Campo
          etiqueta="Nombre del proveedor"
          value={form.nombre}
          maxLength={80}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          error={errores.nombre}
          obligatorio
          autoFocus
        />
        <Campo
          etiqueta="Persona de contacto (opcional)"
          value={form.contacto}
          maxLength={80}
          onChange={(e) => setForm({ ...form, contacto: e.target.value })}
          error={errores.contacto}
        />
        <Campo
          etiqueta="Teléfono (opcional)"
          type="tel"
          inputMode="tel"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          error={errores.telefono}
        />
        <Campo
          etiqueta="Productos que surte (opcional)"
          value={form.productosSurte}
          maxLength={300}
          onChange={(e) => setForm({ ...form, productosSurte: e.target.value })}
          error={errores.productosSurte}
          ayuda="Por ejemplo: «Perfumes árabes, réplicas 1.1, cremas»."
        />
        {proveedor && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="size-6 accent-marca-700"
            />
            Proveedor activo (si lo desactivas, ya no sale al registrar compras)
          </label>
        )}
        <Boton type="submit" ancho cargando={cargando} icono="check">
          {proveedor ? "Guardar cambios" : "Agregar proveedor"}
        </Boton>
      </form>
    </Modal>
  );
}

/* ------------------------------ Ficha del proveedor ------------------------------ */

function FichaProveedor({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const avisos = useAvisos();
  const consulta = useConsulta<{ proveedor: ProveedorDetalle }>(`/api/proveedores/${id}`, { alError: avisos.error });
  const proveedor = consulta.datos?.proveedor ?? null;
  const [abonando, setAbonando] = useState<CompraProveedor | null>(null);

  // La ventana de abono va al lado (no dentro) de la ficha: así Esc cierra solo la ventana de arriba
  return (
    <>
      <Modal abierto onCerrar={onCerrar} titulo={proveedor ? `Proveedor: ${proveedor.nombre}` : "Ficha del proveedor"} tamano="xl">
        {!proveedor ? (
          consulta.error ? <Mensaje tono="peligro">{consulta.error}</Mensaje> : <Cargando />
        ) : (
          <div className="space-y-6">
            <dl className="grid gap-4 rounded-xl bg-superficie p-4 sm:grid-cols-3">
              <Dato etiqueta="Se le debe hoy">
                <span className={`text-2xl font-bold ${proveedor.deuda > 0 ? "text-peligro-800" : "text-exito-800"}`}>{pesos(proveedor.deuda)}</span>
              </Dato>
              <Dato etiqueta="Compras a crédito pendientes">{proveedor.comprasPendientes}</Dato>
              <Dato etiqueta="Total abonado">{pesos(proveedor.totalAbonado)}</Dato>
              <Dato etiqueta="Contacto">{proveedor.contacto ?? "—"}</Dato>
              <Dato etiqueta="Teléfono">{proveedor.telefono ?? "—"}</Dato>
              <Dato etiqueta="Productos que surte">{proveedor.productosSurte ?? "—"}</Dato>
            </dl>

            <section>
              <h3 className="mb-3 text-2xl font-bold">Compras</h3>
              {proveedor.compras.length === 0 ? (
                <p className="text-lg text-texto-suave">Aún no hay compras a este proveedor. Se registran desde «Agregar unidades» de cada perfume.</p>
              ) : (
                <ul className="space-y-4">
                  {proveedor.compras.map((c) => (
                    <li key={c.id} className="rounded-2xl border border-linea bg-tarjeta p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-xl font-bold">
                            {c.productoNombre} · {c.cantidad} {c.cantidad === 1 ? "unidad" : "unidades"}
                          </p>
                          <p className="text-base text-texto-suave">
                            {fechaHora(c.creadoEn)} · Registró {c.usuarioNombre}
                          </p>
                          {c.nota && <p className="break-words text-lg">{c.nota}</p>}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Insignia tono={c.medioPago === "CREDITO" ? "alerta" : "info"}>{textoMedioPagoCompra(c.medioPago)}</Insignia>
                            {c.medioPago === "CREDITO" && (
                              <Insignia tono={c.estado === "SALDADA" ? "exito" : "peligro"}>{textoEstadoCuenta(c.estado)}</Insignia>
                            )}
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-lg">
                            Total: <strong>{pesos(c.total)}</strong>
                          </p>
                          {c.medioPago === "CREDITO" && (
                            <p className="text-lg">
                              Saldo: <strong className={c.saldo > 0 ? "text-peligro-800" : "text-exito-800"}>{pesos(c.saldo)}</strong>
                            </p>
                          )}
                          {c.estado === "SALDADA" && c.saldadaEn && c.medioPago === "CREDITO" && (
                            <p className="text-base text-texto-suave">Saldada el {fechaHora(c.saldadaEn)}</p>
                          )}
                        </div>
                      </div>

                      {c.medioPago === "CREDITO" && (
                        <div className="mt-3 border-t border-linea pt-3">
                          <p className="mb-2 text-lg font-bold">Abonos ({c.abonos.length})</p>
                          {c.abonos.length === 0 ? (
                            <p className="text-base text-texto-suave">Aún no hay abonos.</p>
                          ) : (
                            <ul className="space-y-2">
                              {c.abonos.map((a) => (
                                <li key={a.id} className="flex flex-col gap-1 rounded-xl bg-superficie px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-base">
                                    {fechaDia(a.fecha)} · {textoMedioPago(a.medioPago)} · {a.usuarioNombre}
                                    {a.nota ? ` · ${a.nota}` : ""}
                                  </span>
                                  <strong className="text-lg">{pesos(a.valor)}</strong>
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.estado === "PENDIENTE" && (
                            <div className="mt-3">
                              <Boton variante="exito" icono="dinero" onClick={() => setAbonando(c)} className="w-full sm:w-auto">
                                Abonar a esta compra
                              </Boton>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      {abonando && proveedor && (
        <ModalAbonoProveedor
          compra={abonando}
          proveedorNombre={proveedor.nombre}
          onCerrar={() => setAbonando(null)}
          onListo={(saldada) => {
            avisos.exito(saldada ? "Abono registrado: la compra quedó saldada." : "Abono registrado.");
            setAbonando(null);
            consulta.recargar();
            onCambio();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------ Abonar al proveedor ------------------------------ */

function ModalAbonoProveedor({
  compra,
  proveedorNombre,
  onCerrar,
  onListo,
}: {
  compra: CompraProveedor;
  proveedorNombre: string;
  onCerrar: () => void;
  onListo: (saldada: boolean) => void;
}) {
  const [valor, setValor] = useState(0);
  const [fecha, setFecha] = useState(hoyColombia());
  const [nota, setNota] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | null>(null);
  const [transferencia, setTransferencia] = useState(0);
  const [errorPago, setErrorPago] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (valor <= 0) return setError("Escribe el valor del abono.");
    if (valor > compra.saldo) return setError(`El abono no puede ser mayor que el saldo (${pesos(compra.saldo)}).`);
    if (!fecha || fecha > hoyColombia()) return setError("Escribe una fecha válida (no puede ser futura).");
    if (!medioPago) return setErrorPago("Elige el medio de pago.");
    const { error: errorReparto } = calcularPago(medioPago, valor, transferencia);
    if (errorReparto) return setErrorPago(errorReparto);
    setErrorPago("");
    setError("");
    setCargando(true);
    try {
      const resultado = await api<{ estado: string }>(`/api/compras/${compra.id}/abonos`, {
        method: "POST",
        json: {
          valor,
          fecha,
          nota: nota.trim() || undefined,
          medioPago,
          // En Mixto se envían los dos valores: el servidor los compara con el valor del abono
          ...(medioPago === "MIXTO" ? { valorTransferencia: transferencia, valorEfectivo: valor - transferencia } : {}),
        },
      });
      onListo(resultado.estado === "SALDADA");
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Abonar al proveedor">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <div className="rounded-xl bg-superficie p-4 text-lg">
          <p className="font-bold">{proveedorNombre}</p>
          <p>
            {compra.productoNombre} · {compra.cantidad} {compra.cantidad === 1 ? "unidad" : "unidades"}
          </p>
          <p>
            Saldo pendiente: <strong className="text-peligro-800">{pesos(compra.saldo)}</strong>
          </p>
        </div>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <CampoDinero etiqueta="Valor del abono" valor={valor} onCambio={setValor} obligatorio />
        <Boton variante="secundario" onClick={() => setValor(compra.saldo)} className="w-full sm:w-auto">
          Pagar todo ({pesos(compra.saldo)})
        </Boton>
        <Campo etiqueta="Fecha del pago" type="date" max={hoyColombia()} value={fecha} onChange={(e) => setFecha(e.target.value)} obligatorio />
        <SelectorMedioPago
          titulo="Medio de pago del abono"
          total={valor}
          medio={medioPago}
          onMedio={(m) => {
            setMedioPago(m);
            setErrorPago("");
          }}
          transferencia={transferencia}
          onTransferencia={setTransferencia}
          error={errorPago}
        />
        <Campo etiqueta="Nota (opcional)" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />
        {valor > 0 && valor <= compra.saldo && (
          <p className="text-lg" aria-live="polite">
            Después del abono quedará un saldo de <strong>{pesos(compra.saldo - valor)}</strong>
            {valor === compra.saldo && " — la compra quedará SALDADA."}
          </p>
        )}
        <Boton type="submit" variante="exito" ancho cargando={cargando} icono="check">
          Registrar abono
        </Boton>
      </form>
    </Modal>
  );
}
