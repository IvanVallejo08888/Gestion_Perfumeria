/**
 * Cambios de stock desde el inventario (cada uno deja un movimiento):
 *  - ModalAgregarUnidades: llegó mercancía → INGRESO (nota opcional). Opcionalmente registra la compra
 *    al proveedor (valor y medio de pago); pagada a «Crédito» queda como cuenta por pagar.
 *  - ModalAjuste: corrección manual (daño, conteo…) → AJUSTE (motivo obligatorio).
 * El stock se descuenta por ventas SOLO desde Facturación.
 */
"use client";

import { useState, type FormEvent } from "react";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { useConsulta } from "@/hooks/useConsulta";
import { MEDIOS_PAGO_COMPRA } from "@/lib/cuentas-por-pagar";
import { pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { compraMercanciaSchema } from "@/lib/validaciones";
import type { MedioPagoCompra, Producto, Proveedor } from "@/tipos";

interface Props {
  /** Solo lo que el modal necesita: así también se abre desde el dashboard de reportes. */
  producto: Pick<Producto, "id" | "nombre" | "stock">;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}

const enteroPositivo = (valor: string) => Math.max(0, Math.floor(Number(valor) || 0));

function CampoCantidad({ cantidad, onCambio }: { cantidad: number; onCambio: (n: number) => void }) {
  return (
    <Campo
      etiqueta="Cantidad de unidades"
      type="number"
      inputMode="numeric"
      min={1}
      value={cantidad || ""}
      onChange={(e) => onCambio(enteroPositivo(e.target.value))}
      obligatorio
      autoFocus
    />
  );
}

type ErroresCompra = Partial<Record<"proveedorId" | "total" | "medioPago", string>>;

export function ModalAgregarUnidades({ producto, onCerrar, onListo }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Compra al proveedor (opcional)
  const [conCompra, setConCompra] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [total, setTotal] = useState(0);
  const [medioPago, setMedioPago] = useState<MedioPagoCompra | null>(null);
  const [erroresCompra, setErroresCompra] = useState<ErroresCompra>({});
  const consultaProveedores = useConsulta<{ proveedores: Proveedor[] }>(conCompra ? "/api/proveedores?activos=1" : null);
  const proveedores = consultaProveedores.datos?.proveedores ?? null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (cantidad <= 0) return setError("Escribe una cantidad mayor que cero.");
    let compra: { proveedorId: string; total: number; medioPago: MedioPagoCompra } | undefined;
    if (conCompra) {
      const validacion = compraMercanciaSchema.safeParse({ proveedorId, total, medioPago: medioPago ?? undefined });
      if (!validacion.success) {
        const nuevos: ErroresCompra = {};
        for (const i of validacion.error.issues) nuevos[String(i.path[0]) as keyof ErroresCompra] ??= i.message;
        return setErroresCompra(nuevos);
      }
      compra = validacion.data;
    }
    setErroresCompra({});
    setCargando(true);
    setError("");
    try {
      const { producto: p } = await api<{ producto: { stock: number } }>(`/api/productos/${producto.id}/ingreso`, {
        method: "POST",
        json: { cantidad, nota, compra },
      });
      const proveedor = proveedores?.find((x) => x.id === compra?.proveedorId)?.nombre;
      const detalleCompra = !compra
        ? ""
        : compra.medioPago === "CREDITO"
          ? ` Quedó una deuda de ${pesos(compra.total)} con «${proveedor}».`
          : ` Se registró la compra a «${proveedor}».`;
      onListo(`Se agregaron ${cantidad} unidades a «${producto.nombre}». Ahora hay ${p.stock}.${detalleCompra}`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Agregar unidades">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <p className="text-lg">
          <strong>{producto.nombre}</strong>
          <br />
          Unidades actuales: <strong>{producto.stock}</strong>
        </p>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <CampoCantidad cantidad={cantidad} onCambio={setCantidad} />
        <Campo
          etiqueta="Nota (opcional)"
          value={nota}
          maxLength={200}
          onChange={(e) => setNota(e.target.value)}
          ayuda="Por ejemplo: «Pedido del proveedor, factura 123»."
        />

        <fieldset className="space-y-4 rounded-xl border-2 border-linea p-4">
          <legend className="px-1 text-lg font-bold">Compra al proveedor (opcional)</legend>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg">
            <input type="checkbox" checked={conCompra} onChange={(e) => setConCompra(e.target.checked)} className="size-6 accent-marca-700" />
            Registrar la compra (proveedor, valor y cómo se pagó)
          </label>
          {conCompra &&
            (proveedores?.length === 0 ? (
              <Mensaje tono="alerta">Aún no hay proveedores activos. Agrégalos en Inventario → pestaña «Proveedores».</Mensaje>
            ) : (
              <>
                <Selector
                  etiqueta="Proveedor"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  error={erroresCompra.proveedorId}
                  obligatorio
                >
                  <option value="">{proveedores ? "Elige el proveedor" : "Cargando proveedores…"}</option>
                  {proveedores?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Selector>
                <CampoDinero etiqueta="Valor total de la compra" valor={total} onCambio={setTotal} error={erroresCompra.total} obligatorio />
                <BotonesMedioPago
                  titulo="¿Cómo se pagó?"
                  opciones={[...MEDIOS_PAGO_COMPRA]}
                  valor={medioPago}
                  onCambio={setMedioPago}
                  error={erroresCompra.medioPago}
                />
                {medioPago === "CREDITO" && (
                  <p className="text-lg" aria-live="polite">
                    Quedará una deuda de <strong>{pesos(total)}</strong> con el proveedor. Los abonos se registran en su ficha (Inventario → Proveedores).
                  </p>
                )}
              </>
            ))}
        </fieldset>

        <p className="text-lg" aria-live="polite">
          Quedarán <strong>{producto.stock + cantidad}</strong> unidades.
        </p>
        <Boton type="submit" ancho cargando={cargando} icono="mas">
          Agregar unidades
        </Boton>
      </form>
    </Modal>
  );
}

export function ModalAjuste({ producto, onCerrar, onListo }: Props) {
  const [sentido, setSentido] = useState<"SUMAR" | "RESTAR">("RESTAR");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const resultado = sentido === "SUMAR" ? producto.stock + cantidad : producto.stock - cantidad;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (cantidad <= 0) return setError("Escribe una cantidad mayor que cero.");
    if (resultado < 0) return setError(`Solo hay ${producto.stock} unidades.`);
    if (nota.trim().length < 3) return setError("Escribe el motivo del ajuste.");
    setCargando(true);
    setError("");
    try {
      await api(`/api/productos/${producto.id}/stock`, {
        method: "POST",
        json: { cantidad: sentido === "SUMAR" ? cantidad : -cantidad, nota },
      });
      onListo(`Ajuste guardado en «${producto.nombre}»: ahora hay ${resultado}.`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Ajustar stock">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <p className="text-lg">
          <strong>{producto.nombre}</strong>
          <br />
          Unidades actuales: <strong>{producto.stock}</strong>
        </p>
        <Mensaje tono="info">Usa el ajuste para corregir el conteo o registrar daños. Para mercancía nueva usa «Agregar unidades».</Mensaje>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <BotonesMedioPago
          titulo="¿Qué quieres hacer?"
          opciones={[
            { valor: "RESTAR", texto: "Restar unidades" },
            { valor: "SUMAR", texto: "Sumar unidades" },
          ]}
          valor={sentido}
          onCambio={setSentido}
        />
        <CampoCantidad cantidad={cantidad} onCambio={setCantidad} />
        <Campo
          etiqueta="Motivo del ajuste"
          value={nota}
          maxLength={200}
          onChange={(e) => setNota(e.target.value)}
          obligatorio
          ayuda="Por ejemplo: «Frasco roto» o «Conteo físico del sábado»."
        />
        <p className="text-lg" aria-live="polite">
          Quedarán <strong className={resultado < 0 ? "text-peligro-800" : ""}>{resultado}</strong> unidades.
        </p>
        <Boton type="submit" ancho cargando={cargando} icono="check">
          Guardar ajuste
        </Boton>
      </form>
    </Modal>
  );
}
