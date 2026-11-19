/**
 * Gastos del local (vendedor), en dos pestañas (la pestaña queda en la dirección: ?pestana=deudas):
 *
 * «Gastos»
 *  - Registrar un gasto: categoría, valor, medio de pago, fecha y descripción opcional.
 *    La categoría «Gastos personales» (de la dueña) se ve aparte y no se resta de la utilidad.
 *  - Medio «Crédito» (gasto a crédito): pide a quién se le debe (con sugerencias) y el plan de pagos
 *    (cuotas, frecuencia y fechas editables; valores editables que deben sumar el total).
 *    Ese día NO sale dinero de la caja: se crea una deuda que se paga en la pestaña «Deudas».
 *  - Ver los gastos del mes con filtro por mes y categoría, y sus totales
 *    (gastos de contado + pagos de deudas del mes; un gasto a crédito no suma).
 *  - "Eliminar gasto": cualquier gasto del local, con confirmación y motivo obligatorio.
 *    El gasto no se borra: queda anulado y se ve en el filtro "Eliminados".
 *
 * «Deudas»: ver src/components/deudas/PestanaDeudas.tsx.
 *  - ?pagar=<id> abre directamente la ventana de pago (botón «Ir a pagar» de Notificaciones).
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ConfirmarAnulacionGasto, TablaGastos, TotalesGastos } from "@/components/compartidos/TablaGastos";
import { PestanaDeudas } from "@/components/deudas/PestanaDeudas";
import { EditorCuotas, configInicial, type ConfigCuotas, type FrecuenciaEditor } from "@/components/facturacion/EditorCuotas";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { GrupoOpciones } from "@/components/ui/GrupoOpciones";
import { Pestanas } from "@/components/ui/Pestanas";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { repartirEnCuotas } from "@/lib/deudas";
import { anioMesColombia, hoyColombia, MESES, normalizarTexto, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { MEDIOS_PAGO_GASTO } from "@/lib/pagos";
import { gastoSchema } from "@/lib/validaciones";
import type { CategoriaGastoOpcion, GastoFila, ListaGastos, MedioPagoGasto } from "@/tipos";

const HOY = anioMesColombia(new Date());
const ANIOS = Array.from({ length: 6 }, (_, i) => HOY.anio - i);

/** Filtro de la lista: los gastos vigentes o los eliminados (anulados). */
const VISTAS_GASTOS = [
  { valor: "vigentes", texto: "Gastos vigentes" },
  { valor: "eliminados", texto: "Eliminados" },
] as const;

const PESTANAS = [
  { id: "gastos", titulo: "Gastos" },
  { id: "deudas", titulo: "Deudas" },
] as const;

export default function PaginaGastos() {
  // useSearchParams necesita un <Suspense> alrededor (Next.js)
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoGastos />
    </Suspense>
  );
}

function ContenidoGastos() {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const pestana = parametros.get("pestana") === "deudas" ? "deudas" : "gastos";
  const pagarId = parametros.get("pagar");
  const verId = parametros.get("ver");

  /** Cambia la pestaña (y abre una deuda si se indica) dejando todo en la dirección. */
  function irA(destino: "gastos" | "deudas", extra: Record<string, string> = {}) {
    const p = new URLSearchParams(destino === "deudas" ? { pestana: "deudas", ...extra } : {});
    router.replace(p.size ? `${ruta}?${p}` : ruta, { scroll: false });
  }

  const avisos = useAvisos();
  const [anio, setAnio] = useState(HOY.anio);
  const [mes, setMes] = useState(HOY.mes);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [verEliminados, setVerEliminados] = useState(false);
  const [eliminando, setEliminando] = useState<GastoFila | null>(null);

  const consultaCategorias = useConsulta<{ categorias: CategoriaGastoOpcion[] }>("/api/gastos/categorias", { alError: avisos.error });
  const categorias = consultaCategorias.datos?.categorias ?? [];

  const params = new URLSearchParams({ anio: String(anio), mes: String(mes) });
  if (categoriaFiltro) params.set("categoriaId", categoriaFiltro);
  if (verEliminados) params.set("estado", "eliminados");
  const consulta = useConsulta<ListaGastos>(`/api/gastos?${params}`, { alError: avisos.error });
  const datos = consulta.datos;

  const verDeuda = (id: string) => irA("deudas", { ver: id });

  return (
    <>
      <EncabezadoPagina titulo="Gastos" descripcion="Registra los gastos del local, revisa los del mes y paga tus deudas." />

      <Pestanas etiqueta="Secciones de gastos" pestanas={PESTANAS} activa={pestana} onCambio={(id) => irA(id as "gastos" | "deudas")}>
        {pestana === "deudas" ? (
          <PestanaDeudas
            pagarId={pagarId}
            verId={verId}
            onCambio={consulta.recargar}
            // Al cerrar la ventana se quita ?pagar= para que no se vuelva a abrir al recargar
            onCerrarPago={() => pagarId && irA("deudas")}
          />
        ) : (
          <>
            <FormularioGasto
              categorias={categorias}
              cargandoCategorias={consultaCategorias.cargando}
              onGuardado={consulta.recargar}
              onVerDeudas={() => irA("deudas")}
            />

            <h2 className="mb-3 mt-8 text-2xl font-bold">
              Gastos de {MESES[mes - 1]} de {anio}
            </h2>

            <Tarjeta className="mb-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Selector etiqueta="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Selector>
                <Selector etiqueta="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                  {ANIOS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Selector>
                <Selector etiqueta="Categoría" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </div>
              <div className="mt-4">
                <GrupoOpciones
                  etiqueta="Qué gastos ver"
                  opciones={VISTAS_GASTOS}
                  valor={verEliminados ? "eliminados" : "vigentes"}
                  onCambio={(v) => setVerEliminados(v === "eliminados")}
                />
              </div>
            </Tarjeta>

            {consulta.error ? (
              <Mensaje tono="peligro">{consulta.error}</Mensaje>
            ) : !datos ? (
              <Cargando />
            ) : (
              <div className="space-y-6">
                <TotalesGastos datos={datos} />
                {verEliminados && <h3 className="text-xl font-bold">Gastos eliminados (no suman en los totales)</h3>}
                <TablaGastos
                  gastos={datos.gastos}
                  onEliminar={setEliminando}
                  onVerDeuda={verDeuda}
                  vacio={verEliminados ? "No hay gastos eliminados en este periodo." : "Prueba con otro mes o categoría."}
                />
              </div>
            )}
          </>
        )}
      </Pestanas>

      <ConfirmarAnulacionGasto
        gasto={eliminando}
        urlAnular={(id) => `/api/gastos/${id}/anular`}
        onCerrar={() => setEliminando(null)}
        onAnulado={() => {
          setEliminando(null);
          avisarCambioNotificaciones();
          // Recarga la lista y los totales del mes al instante
          consulta.recargar();
        }}
        onVerDeuda={verDeuda}
      />
    </>
  );
}

/* ------------------------------ Formulario ------------------------------ */

interface FormGasto {
  categoriaId: string;
  valor: number;
  medioPago: MedioPagoGasto | null;
  fecha: string;
  descripcion: string;
  /** Solo en Crédito */
  acreedor: string;
}

const formInicial = (): FormGasto => ({ categoriaId: "", valor: 0, medioPago: null, fecha: hoyColombia(), descripcion: "", acreedor: "" });

function FormularioGasto({
  categorias,
  cargandoCategorias,
  onGuardado,
  onVerDeudas,
}: {
  categorias: CategoriaGastoOpcion[];
  cargandoCategorias: boolean;
  onGuardado: () => void;
  onVerDeudas: () => void;
}) {
  const avisos = useAvisos();
  const [form, setForm] = useState<FormGasto>(formInicial);
  const [plan, setPlan] = useState<ConfigCuotas<FrecuenciaEditor>>(configInicial);
  const [valores, setValores] = useState<number[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [deudaRegistrada, setDeudaRegistrada] = useState<string | null>(null);

  const esCredito = form.medioPago === "CREDITO";
  // Sugerencias de acreedores (los ya usados en el local y los proveedores): solo si se eligió Crédito
  const consultaAcreedores = useConsulta<{ acreedores: string[] }>(esCredito ? "/api/deudas/acreedores" : null);
  const textoAcreedor = normalizarTexto(form.acreedor);
  const sugerencias = (consultaAcreedores.datos?.acreedores ?? [])
    .filter((a) => normalizarTexto(a) !== textoAcreedor && (!textoAcreedor || normalizarTexto(a).includes(textoAcreedor)))
    .slice(0, 6);

  /** Al cambiar el valor o elegir Crédito, las cuotas se reparten en partes iguales. */
  function cambiarValor(valor: number) {
    setForm({ ...form, valor });
    setValores(repartirEnCuotas(valor, plan.cantidad));
  }
  function cambiarMedio(medioPago: MedioPagoGasto) {
    setForm({ ...form, medioPago });
    if (medioPago === "CREDITO" && valores.length !== plan.cantidad) setValores(repartirEnCuotas(form.valor, plan.cantidad));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral("");
    setDeudaRegistrada(null);
    const cuotas = esCredito
      ? plan.fechas.map((f, i) => ({ fechaVencimiento: f ? new Date(f).toISOString() : "", valor: valores[i] ?? 0 }))
      : undefined;
    const validacion = gastoSchema.safeParse({
      categoriaId: form.categoriaId,
      valor: form.valor,
      medioPago: form.medioPago ?? undefined,
      fecha: form.fecha,
      descripcion: form.descripcion.trim() || undefined,
      ...(esCredito ? { acreedor: form.acreedor.trim(), cuotas } : {}),
    });
    if (!validacion.success) {
      const nuevos: Record<string, string> = {};
      for (const i of validacion.error.issues) nuevos[String(i.path[0])] ??= i.message;
      return setErrores(nuevos);
    }
    setErrores({});
    setGuardando(true);
    try {
      await api("/api/gastos", { method: "POST", json: validacion.data });
      if (esCredito) {
        const texto = `Deuda con ${form.acreedor.trim()} registrada: ${plan.cantidad} ${plan.cantidad === 1 ? "cuota" : "cuotas"} por ${pesos(form.valor)}. Hoy no sale dinero de la caja.`;
        avisos.exito(texto);
        setDeudaRegistrada(texto);
        avisarCambioNotificaciones();
      } else {
        avisos.exito("Gasto registrado.");
      }
      setForm(formInicial());
      setPlan(configInicial());
      setValores([]);
      onGuardado();
    } catch (err) {
      setErrorGeneral((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 className="mb-4 text-2xl font-bold">Registrar gasto</h2>
      {!cargandoCategorias && categorias.length === 0 && (
        <div className="mb-4">
          <Mensaje tono="alerta">El administrador aún no ha agregado categorías de gastos para este local.</Mensaje>
        </div>
      )}
      {deudaRegistrada && (
        <div className="mb-4 space-y-3">
          <Mensaje tono="exito">{deudaRegistrada}</Mensaje>
          <Boton variante="secundario" icono="dinero" onClick={onVerDeudas}>
            Ver mis deudas
          </Boton>
        </div>
      )}
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {errorGeneral && <Mensaje tono="peligro">{errorGeneral}</Mensaje>}
        <div className="grid gap-5 md:grid-cols-2">
          <Selector
            etiqueta="Categoría"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            error={errores.categoriaId}
            ayuda={
              categorias.find((c) => c.id === form.categoriaId)?.personal
                ? "Gasto personal de la dueña: se guarda aparte y no se resta de la utilidad del negocio."
                : undefined
            }
            obligatorio
          >
            <option value="">Elige una categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
          <CampoDinero
            etiqueta={esCredito ? "Valor total de la deuda" : "Valor"}
            valor={form.valor}
            onCambio={cambiarValor}
            error={errores.valor}
            obligatorio
          />
        </div>
        <BotonesMedioPago titulo="Medio de pago" opciones={MEDIOS_PAGO_GASTO} valor={form.medioPago} onCambio={cambiarMedio} error={errores.medioPago} />

        {esCredito && (
          <div className="space-y-5 rounded-2xl border-2 border-marca-700 bg-superficie p-4">
            <Mensaje tono="info">
              Gasto a crédito: hoy <strong>no</strong> sale dinero de la caja. Se crea una deuda y el dinero sale con cada pago, en la pestaña «Deudas».
            </Mensaje>
            <div>
              <Campo
                etiqueta="¿A quién le debes?"
                placeholder="Ejemplo: Distribuidora Aromas"
                maxLength={80}
                autoComplete="off"
                value={form.acreedor}
                onChange={(e) => setForm({ ...form, acreedor: e.target.value })}
                error={errores.acreedor}
                obligatorio
              />
              {sugerencias.length > 0 && (
                <div className="mt-2">
                  <p className="text-base text-texto-suave">Toca un nombre para usarlo:</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {sugerencias.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, acreedor: s })}
                          className="min-h-12 rounded-xl border-2 border-borde bg-tarjeta px-4 text-lg font-bold hover:border-marca-700 hover:bg-marca-50"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <EditorCuotas
              titulo="Plan de pagos"
              accion="pago"
              config={plan}
              onCambio={setPlan}
              total={form.valor}
              valores={valores}
              onValores={setValores}
              permitirPersonalizadas
              avisarVencidas
              error={errores.cuotas}
            />
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            etiqueta={esCredito ? "Fecha en que adquiriste la deuda" : "Fecha"}
            type="date"
            max={hoyColombia()}
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            error={errores.fecha}
            obligatorio
          />
          <Campo
            etiqueta="Descripción (opcional)"
            maxLength={200}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            error={errores.descripcion}
          />
        </div>
        <Boton type="submit" icono="check" cargando={guardando} disabled={categorias.length === 0} className="w-full sm:w-auto sm:min-w-72">
          {esCredito ? "Registrar gasto a crédito" : "Registrar gasto"}
        </Boton>
      </form>
    </Tarjeta>
  );
}
