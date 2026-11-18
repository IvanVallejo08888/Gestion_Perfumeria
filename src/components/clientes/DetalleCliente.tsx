/**
 * Detalle de un cliente: resumen en tarjetas grandes y récord histórico de facturas.
 * Se usa debajo del buscador (computador, o cuando hay coincidencia exacta) y como
 * página completa en /panel/clientes/[id] (celular).
 *
 *  - Los totales NO incluyen las ventas anuladas; esas se muestran aparte.
 *  - El récord se pide por clienteId: sigue completo aunque se corrija la cédula.
 *  - "Editar datos" no cambia las facturas antiguas (son el registro de cada venta).
 */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DetalleFactura } from "@/components/facturacion/DetalleFactura";
import { TarjetaFactura } from "@/components/facturacion/TarjetaFactura";
import { useAvisos } from "@/components/ui/Avisos";
import { Cargando, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, Selector } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { Modal } from "@/components/ui/Modal";
import { Paginacion } from "@/components/ui/Paginacion";
import { useConsulta } from "@/hooks/useConsulta";
import { fecha, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { clienteSchema } from "@/lib/validaciones";
import type { ClienteDatos, ClienteDetalle, ListaFacturasCliente, NombreActivo, ResumenCliente } from "@/tipos";

const FILTROS = [
  { valor: "", texto: "Todas" },
  { valor: "COMPLETADA", texto: "Completadas" },
  { valor: "PENDIENTE", texto: "Pendientes" },
  { valor: "ANULADA", texto: "Anuladas" },
];

export function DetalleCliente({
  clienteId,
  onCerrar,
  onEditado,
}: {
  clienteId: string;
  /** Si se indica, muestra el botón "Cerrar detalle" (vista debajo del buscador). */
  onCerrar?: () => void;
  /** Se llama después de editar (para refrescar la lista de clientes). */
  onEditado?: () => void;
}) {
  const consulta = useConsulta<{ cliente: ClienteDetalle; resumen: ResumenCliente }>(`/api/clientes/${clienteId}`);
  const datos = consulta.urlDatos === `/api/clientes/${clienteId}` ? consulta.datos : null;
  const [editando, setEditando] = useState(false);

  if (consulta.error) return <Mensaje tono="peligro">{consulta.error}</Mensaje>;
  if (!datos) return <Cargando texto="Cargando cliente…" />;
  const { cliente, resumen } = datos;

  const tarjetas: { titulo: string; valor: string; detalle?: string; destacado?: boolean }[] = [
    {
      titulo: "Compras",
      valor: String(resumen.comprasContado + resumen.comprasCredito),
      detalle: `${resumen.comprasContado} de contado · ${resumen.comprasCredito} a crédito`,
    },
    { titulo: "Total comprado", valor: pesos(resumen.totalComprado) },
    { titulo: "Total pagado", valor: pesos(resumen.totalPagado) },
    { titulo: "Saldo pendiente", valor: pesos(resumen.saldoPendiente), destacado: resumen.saldoPendiente > 0 },
    { titulo: "Créditos pendientes", valor: String(resumen.creditosPendientes) },
    {
      titulo: "Primera y última compra",
      valor: resumen.ultimaCompra ? fecha(resumen.ultimaCompra) : "Sin compras aún",
      detalle: resumen.primeraCompra ? `Primera: ${fecha(resumen.primeraCompra)}` : undefined,
    },
    {
      titulo: "Producto que más compra",
      valor: resumen.productoFavorito?.nombre ?? "—",
      detalle: resumen.productoFavorito
        ? `${resumen.productoFavorito.cantidad} ${resumen.productoFavorito.cantidad === 1 ? "unidad" : "unidades"}`
        : undefined,
    },
    {
      titulo: "Ventas anuladas",
      valor: String(resumen.anuladas.cantidad),
      detalle: resumen.anuladas.cantidad ? `${pesos(resumen.anuladas.total)} (no suman en los totales)` : "No suman en los totales",
    },
  ];

  return (
    <section aria-labelledby={`cliente-${cliente.id}`} className="space-y-6">
      <Tarjeta>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id={`cliente-${cliente.id}`} className="text-3xl font-bold break-words">
              {cliente.nombre}
            </h2>
            <dl className="mt-2 grid gap-1 text-lg">
              <div>
                <dt className="inline font-bold">Cédula: </dt>
                <dd className="inline">{cliente.identificacion}</dd>
              </div>
              <div>
                <dt className="inline font-bold">Teléfono: </dt>
                <dd className="inline">{cliente.telefono}</dd>
              </div>
              <div className="break-words">
                <dt className="inline font-bold">Dirección: </dt>
                <dd className="inline">{cliente.direccion}</dd>
              </div>
              <div>
                <dt className="inline font-bold">Sector: </dt>
                <dd className="inline">{cliente.sector}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Boton variante="secundario" icono="editar" onClick={() => setEditando(true)}>
              Editar datos
            </Boton>
            {resumen.creditosPendientes > 0 && (
              <Link
                href={`/panel/creditos?identificacion=${encodeURIComponent(cliente.identificacion)}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-marca-700 bg-marca-700 px-5 text-lg font-bold text-white hover:bg-marca-800"
              >
                <Icono nombre="credito" />
                Ir a sus créditos
              </Link>
            )}
            {onCerrar && (
              <Boton variante="fantasma" icono="cerrar" onClick={onCerrar}>
                Cerrar detalle
              </Boton>
            )}
          </div>
        </div>
      </Tarjeta>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del cliente">
        {tarjetas.map((t) => (
          <li
            key={t.titulo}
            className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${t.destacado ? "border-peligro-700" : "border-gray-200"}`}
          >
            <p className="text-lg font-bold text-texto-suave">{t.titulo}</p>
            <p className={`mt-1 text-2xl font-bold break-words ${t.destacado ? "text-peligro-700" : "text-marca-800"}`}>{t.valor}</p>
            {t.detalle && <p className="mt-1 text-base text-texto-suave">{t.detalle}</p>}
          </li>
        ))}
      </ul>

      {/* key: al cambiar de cliente, el filtro y la página del récord vuelven a empezar */}
      <RecordFacturas key={cliente.id} clienteId={cliente.id} />

      {editando && (
        <EditarCliente
          cliente={cliente}
          onCerrar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            consulta.recargar();
            onEditado?.();
          }}
        />
      )}
    </section>
  );
}

/* ----------------------------- Récord de facturas ----------------------------- */

function RecordFacturas({ clienteId }: { clienteId: string }) {
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const params = new URLSearchParams({ pagina: String(pagina) });
  if (estado) params.set("estado", estado);
  const consulta = useConsulta<ListaFacturasCliente>(`/api/clientes/${clienteId}/facturas?${params}`);
  const datos = consulta.datos;

  return (
    <section aria-labelledby="record-titulo" className="space-y-4">
      <h3 id="record-titulo" className="text-2xl font-bold">
        Récord de compras
      </h3>
      <div role="group" aria-label="Filtrar facturas del cliente" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => {
              setEstado(f.valor);
              setPagina(1);
            }}
            aria-pressed={estado === f.valor}
            className={`min-h-12 rounded-xl border-2 px-4 text-lg font-bold ${
              estado === f.valor ? "border-marca-700 bg-marca-700 text-white" : "border-borde bg-white hover:bg-gray-50"
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {consulta.error ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !datos ? (
        <Cargando />
      ) : datos.facturas.length === 0 ? (
        <Vacio icono="historial" titulo="No hay facturas para mostrar">
          {estado ? "Prueba con otro filtro." : "Este cliente aún no tiene compras."}
        </Vacio>
      ) : (
        <>
          <ul className="space-y-3">
            {datos.facturas.map((f) => (
              <li key={f.id}>
                <TarjetaFactura factura={f} onVer={() => setDetalleId(f.id)} />
              </li>
            ))}
          </ul>
          {datos.totalPaginas > 1 && (
            <Paginacion
              etiqueta="Páginas del récord de compras"
              pagina={datos.pagina}
              totalPaginas={datos.totalPaginas}
              total={datos.total}
              nombres={["facturas", "factura"]}
              onIr={setPagina}
            />
          )}
        </>
      )}

      <DetalleFactura facturaId={detalleId} onCerrar={() => setDetalleId(null)} />
    </section>
  );
}

/* --------------------------------- Editar --------------------------------- */

function EditarCliente({ cliente, onCerrar, onGuardado }: { cliente: ClienteDetalle; onCerrar: () => void; onGuardado: () => void }) {
  const avisos = useAvisos();
  const [form, setForm] = useState<ClienteDatos>({
    identificacion: cliente.identificacion,
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    sector: cliente.sector,
  });
  const [errores, setErrores] = useState<Partial<Record<keyof ClienteDatos, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Sectores activos del local; si el sector actual del cliente se desactivó, se conserva como opción
  const consultaSectores = useConsulta<{ sectores: NombreActivo[] }>("/api/sectores");
  const sectores = consultaSectores.datos?.sectores ?? null;
  const nombresSector = sectores ? sectores.map((s) => s.nombre) : [];
  if (sectores && !nombresSector.includes(cliente.sector)) nombresSector.unshift(cliente.sector);

  const cambiar = (campo: keyof ClienteDatos, valor: string) => setForm({ ...form, [campo]: valor });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral("");
    // Mismas reglas que al facturar (clienteSchema)
    const validacion = clienteSchema.safeParse(form);
    if (!validacion.success) {
      const nuevos: Partial<Record<keyof ClienteDatos, string>> = {};
      for (const i of validacion.error.issues) nuevos[i.path[0] as keyof ClienteDatos] ??= i.message;
      return setErrores(nuevos);
    }
    setErrores({});
    setGuardando(true);
    try {
      await api(`/api/clientes/${cliente.id}`, { method: "PUT", json: validacion.data });
      avisos.exito("Datos del cliente actualizados.");
      onGuardado();
    } catch (err) {
      // Por ejemplo: "Ya existe otro cliente con la cédula … en este local"
      setErrorGeneral((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Editar datos del cliente" tamano="lg">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <Mensaje tono="info">Las facturas anteriores conservan los datos que tenían el día de la venta.</Mensaje>
        {errorGeneral && <Mensaje tono="peligro">{errorGeneral}</Mensaje>}
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            etiqueta="Nombre"
            value={form.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            error={errores.nombre}
            obligatorio
            autoComplete="off"
          />
          <Campo
            etiqueta="Cédula"
            inputMode="numeric"
            value={form.identificacion}
            onChange={(e) => cambiar("identificacion", e.target.value.replace(/\D/g, ""))}
            error={errores.identificacion}
            obligatorio
            autoComplete="off"
          />
          <Campo
            etiqueta="Teléfono"
            type="tel"
            inputMode="tel"
            value={form.telefono}
            onChange={(e) => cambiar("telefono", e.target.value)}
            error={errores.telefono}
            obligatorio
            autoComplete="off"
          />
          <Selector etiqueta="Sector" value={form.sector} onChange={(e) => cambiar("sector", e.target.value)} error={errores.sector} obligatorio>
            {!sectores && <option value={form.sector}>Cargando sectores…</option>}
            {nombresSector.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </Selector>
          <Campo
            className="md:col-span-2"
            etiqueta="Dirección completa (con barrio)"
            value={form.direccion}
            onChange={(e) => cambiar("direccion", e.target.value)}
            error={errores.direccion}
            obligatorio
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" icono="check" cargando={guardando}>
            Guardar cambios
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
