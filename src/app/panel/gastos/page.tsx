/**
 * Gastos del local (vendedor):
 *  - Registrar un gasto: categoría, valor, medio de pago, fecha y descripción opcional.
 *  - Ver los gastos del mes con filtro por mes y categoría, y sus totales.
 *  - Eliminar solo los gastos propios registrados hoy (con confirmación).
 */
"use client";

import { useState, type FormEvent } from "react";
import { TablaGastos, TotalesGastos } from "@/components/compartidos/TablaGastos";
import { BotonesMedioPago } from "@/components/facturacion/MedioPago";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoDinero, Selector } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { Confirmar } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { anioMesColombia, hoyColombia, MESES, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { MEDIOS_PAGO_GASTO } from "@/lib/pagos";
import { gastoSchema } from "@/lib/validaciones";
import type { GastoFila, ListaGastos, MedioPagoGasto, NombreActivo } from "@/tipos";

const HOY = anioMesColombia(new Date());
const ANIOS = Array.from({ length: 6 }, (_, i) => HOY.anio - i);

interface FormGasto {
  categoriaId: string;
  valor: number;
  medioPago: MedioPagoGasto | null;
  fecha: string;
  descripcion: string;
}

const formInicial = (): FormGasto => ({ categoriaId: "", valor: 0, medioPago: null, fecha: hoyColombia(), descripcion: "" });

export default function PaginaGastos() {
  const avisos = useAvisos();
  const [anio, setAnio] = useState(HOY.anio);
  const [mes, setMes] = useState(HOY.mes);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [eliminando, setEliminando] = useState<GastoFila | null>(null);
  const [borrando, setBorrando] = useState(false);

  const consultaCategorias = useConsulta<{ categorias: NombreActivo[] }>("/api/gastos/categorias", { alError: avisos.error });
  const categorias = consultaCategorias.datos?.categorias ?? [];

  const params = new URLSearchParams({ anio: String(anio), mes: String(mes) });
  if (categoriaFiltro) params.set("categoriaId", categoriaFiltro);
  const consulta = useConsulta<ListaGastos>(`/api/gastos?${params}`, { alError: avisos.error });
  const datos = consulta.datos;

  async function eliminar() {
    if (!eliminando) return;
    setBorrando(true);
    try {
      await api(`/api/gastos/${eliminando.id}`, { method: "DELETE" });
      avisos.exito("Gasto eliminado.");
      setEliminando(null);
      consulta.recargar();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Gastos" descripcion="Registra los gastos del local y revisa los del mes." />

      <FormularioGasto categorias={categorias} cargandoCategorias={consultaCategorias.cargando} onGuardado={consulta.recargar} />

      <h2 className="mb-3 mt-8 text-2xl font-bold">Gastos de {MESES[mes - 1]} de {anio}</h2>

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
      </Tarjeta>

      {consulta.error ? (
        <Mensaje tono="peligro">{consulta.error}</Mensaje>
      ) : !datos ? (
        <Cargando />
      ) : (
        <div className="space-y-6">
          <TotalesGastos datos={datos} />
          <TablaGastos gastos={datos.gastos} onEliminar={setEliminando} />
        </div>
      )}

      <Confirmar
        abierto={eliminando !== null}
        titulo="Eliminar gasto"
        mensaje={eliminando && `¿Eliminar el gasto de ${eliminando.categoriaNombre} por ${pesos(eliminando.valor)}? Dejará de contar en las estadísticas y en el Excel. Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar gasto"
        peligro
        cargando={borrando}
        onConfirmar={eliminar}
        onCerrar={() => setEliminando(null)}
      />
    </>
  );
}

function FormularioGasto({
  categorias,
  cargandoCategorias,
  onGuardado,
}: {
  categorias: NombreActivo[];
  cargandoCategorias: boolean;
  onGuardado: () => void;
}) {
  const avisos = useAvisos();
  const [form, setForm] = useState<FormGasto>(formInicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral("");
    const validacion = gastoSchema.safeParse({ ...form, descripcion: form.descripcion.trim() || undefined });
    if (!validacion.success) {
      const nuevos: Record<string, string> = {};
      for (const i of validacion.error.issues) nuevos[String(i.path[0])] ??= i.message;
      return setErrores(nuevos);
    }
    setErrores({});
    setGuardando(true);
    try {
      await api("/api/gastos", { method: "POST", json: validacion.data });
      avisos.exito("Gasto registrado.");
      setForm(formInicial());
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
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {errorGeneral && <Mensaje tono="peligro">{errorGeneral}</Mensaje>}
        <div className="grid gap-5 md:grid-cols-2">
          <Selector
            etiqueta="Categoría"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            error={errores.categoriaId}
            obligatorio
          >
            <option value="">Elige una categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
          <CampoDinero etiqueta="Valor" valor={form.valor} onCambio={(valor) => setForm({ ...form, valor })} error={errores.valor} obligatorio />
        </div>
        <BotonesMedioPago
          titulo="Medio de pago"
          opciones={MEDIOS_PAGO_GASTO}
          valor={form.medioPago}
          onCambio={(medioPago) => setForm({ ...form, medioPago })}
          error={errores.medioPago}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            etiqueta="Fecha"
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
          Registrar gasto
        </Boton>
      </form>
    </Tarjeta>
  );
}
