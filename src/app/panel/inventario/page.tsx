/**
 * Inventario de perfumes del local.
 *  - Pestañas Todos | Hombre | Mujer, chips de público y filtros combinables (marca, tipo,
 *    categoría, estado de stock y buscador). Todo queda en la URL: ?genero=MUJER&tipo=ORIGINAL…
 *  - Por perfume: «Agregar unidades» (INGRESO) y «Vender» (abre Facturación con el perfume cargado).
 *  - Detalle: datos, últimos 20 movimientos, editar, ajustar stock (AJUSTE con motivo) y eliminar.
 *  - El stock se descuenta por ventas SOLO desde Facturación (movimiento VENTA).
 *  - Pestaña «Proveedores»: alta y edición de proveedores, lo que se les debe y sus abonos.
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BarraFiltros } from "@/components/inventario/BarraFiltros";
import { DetalleProducto } from "@/components/inventario/DetalleProducto";
import { ListaProductos } from "@/components/inventario/ListaProductos";
import { ModalAgregarUnidades, ModalAjuste } from "@/components/inventario/ModalesStock";
import { GestionProveedores } from "@/components/inventario/GestionProveedores";
import { ModalProducto } from "@/components/inventario/ModalProducto";
import { Boton } from "@/components/ui/Boton";
import { Cargando, EncabezadoPagina, Vacio } from "@/components/ui/Basicos";
import { Confirmar } from "@/components/ui/Modal";
import { Pestanas } from "@/components/ui/Pestanas";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { api } from "@/lib/http";
import { filtrosAUrl, leerFiltros, type FiltrosInventario } from "@/lib/inventario";
import type { NombreActivo, Producto } from "@/tipos";

const PESTANAS = [
  { id: "perfumes", titulo: "Perfumes" },
  { id: "proveedores", titulo: "Proveedores" },
] as const;
type Vista = (typeof PESTANAS)[number]["id"];

type Accion =
  | { tipo: "nuevo" }
  | { tipo: "editar" | "unidades" | "ajuste" | "detalle"; producto: Producto };

export default function PaginaInventario() {
  // useSearchParams necesita un <Suspense> alrededor (Next.js)
  return (
    <Suspense fallback={<Cargando />}>
      <Inventario />
    </Suspense>
  );
}

function Inventario() {
  const avisos = useAvisos();
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const filtros = useMemo(() => leerFiltros(parametros), [parametros]);
  const consultaFiltros = filtrosAUrl(filtros);

  const cambiarFiltros = (nuevos: FiltrosInventario) => router.replace(`${ruta}${filtrosAUrl(nuevos)}`, { scroll: false });

  // El buscador se escribe en el campo y se aplica a la URL con un pequeño retraso
  const [texto, setTexto] = useState(filtros.q ?? "");
  const textoBuscado = useValorDiferido(texto.trim(), 300);
  useEffect(() => {
    if (textoBuscado !== (filtros.q ?? "")) cambiarFiltros({ ...filtros, q: textoBuscado || undefined });
    // Solo reacciona al texto escrito, no a cada cambio de filtros
  }, [textoBuscado]); // eslint-disable-line react-hooks/exhaustive-deps

  const consulta = useConsulta<{ productos: Producto[]; hayMas: boolean }>(`/api/productos${consultaFiltros}`, { alError: avisos.error });
  const productos = consulta.datos?.productos ?? (consulta.error ? [] : null);
  const marcas = useConsulta<{ marcas: NombreActivo[] }>("/api/marcas").datos?.marcas ?? null;

  const [vista, setVista] = useState<Vista>("perfumes");
  const [accion, setAccion] = useState<Accion | null>(null);
  const [eliminando, setEliminando] = useState<Producto | null>(null);
  const [cargandoEliminar, setCargandoEliminar] = useState(false);

  const cerrar = () => setAccion(null);
  const listo = (mensaje: string) => {
    avisos.exito(mensaje);
    setAccion(null);
    consulta.recargar();
    avisarCambioNotificaciones();
  };

  async function eliminar() {
    if (!eliminando) return;
    setCargandoEliminar(true);
    try {
      await api(`/api/productos/${eliminando.id}`, { method: "DELETE" });
      avisos.exito(`«${eliminando.nombre}» fue eliminado del inventario.`);
      setEliminando(null);
      consulta.recargar();
      avisarCambioNotificaciones();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setCargandoEliminar(false);
    }
  }

  const hayFiltros = consultaFiltros !== "";

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Perfumes y proveedores de tu local. Al vender, el stock se descuenta solo."
        acciones={
          vista === "perfumes" && (
            <Boton icono="mas" onClick={() => setAccion({ tipo: "nuevo" })}>
              Agregar producto
            </Boton>
          )
        }
      />

      <Pestanas etiqueta="Secciones del inventario" pestanas={PESTANAS} activa={vista} onCambio={(id) => setVista(id as Vista)}>
        {vista === "proveedores" ? (
          <GestionProveedores />
        ) : (
          <>
            <BarraFiltros
              filtros={filtros}
              onCambiar={(nuevos) => {
                if (!nuevos.q) setTexto("");
                cambiarFiltros(nuevos);
              }}
              texto={texto}
              onTexto={setTexto}
              marcas={marcas}
            />

            {!productos ? (
              <Cargando />
            ) : productos.length === 0 ? (
              <Vacio icono="inventario" titulo={hayFiltros ? "No hay perfumes con esos filtros" : "Tu inventario está vacío"}>
                {hayFiltros ? "Prueba con otros filtros o presiona «Quitar filtros»." : "Presiona «Agregar producto» para empezar."}
              </Vacio>
            ) : (
              <>
                <p className="mb-3 text-lg text-texto-suave" aria-live="polite">
                  {productos.length === 1 ? "1 perfume" : `${productos.length} perfumes`}
                  {consulta.datos?.hayMas && " (se muestran los primeros; usa los filtros para ver el resto)"}
                </p>
                <ListaProductos
                  productos={productos}
                  onAgregarUnidades={(producto) => setAccion({ tipo: "unidades", producto })}
                  onDetalle={(producto) => setAccion({ tipo: "detalle", producto })}
                />
              </>
            )}
          </>
        )}
      </Pestanas>

      {accion?.tipo === "nuevo" && <ModalProducto producto={null} onCerrar={cerrar} onListo={listo} />}
      {accion?.tipo === "editar" && <ModalProducto producto={accion.producto} onCerrar={cerrar} onListo={listo} />}
      {accion?.tipo === "unidades" && <ModalAgregarUnidades producto={accion.producto} onCerrar={cerrar} onListo={listo} />}
      {accion?.tipo === "ajuste" && <ModalAjuste producto={accion.producto} onCerrar={cerrar} onListo={listo} />}
      {accion?.tipo === "detalle" && (
        <DetalleProducto
          producto={accion.producto}
          onCerrar={cerrar}
          onAgregarUnidades={() => setAccion({ tipo: "unidades", producto: accion.producto })}
          onEditar={() => setAccion({ tipo: "editar", producto: accion.producto })}
          onAjustar={() => setAccion({ tipo: "ajuste", producto: accion.producto })}
          onEliminar={() => {
            setEliminando(accion.producto);
            setAccion(null);
          }}
        />
      )}

      <Confirmar
        abierto={eliminando !== null}
        titulo="Eliminar producto"
        mensaje={
          <>
            ¿Eliminar <strong>{eliminando?.nombre}</strong> del inventario? Ya no se podrá vender. Las facturas anteriores no se afectan.
          </>
        }
        textoConfirmar="Eliminar producto"
        peligro
        cargando={cargandoEliminar}
        onConfirmar={eliminar}
        onCerrar={() => setEliminando(null)}
      />
    </>
  );
}
