/**
 * Inventario de perfumes del local.
 *  - Pestañas Todos | Hombre | Mujer, chips de público y filtros combinables (marca, tipo,
 *    tamaño, estado de stock y buscador). Todo queda en la URL: ?genero=MUJER&tipo=ORIGINAL…
 *  - Por perfume: «Agregar unidades» (INGRESO) y «Vender» (abre Facturación con el perfume cargado).
 *  - Detalle: datos, últimos 20 movimientos, editar, ajustar stock (AJUSTE con motivo) y eliminar.
 *  - El stock se descuenta por ventas SOLO desde Facturación (movimiento VENTA).
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BarraFiltros } from "@/components/inventario/BarraFiltros";
import { DetalleProducto } from "@/components/inventario/DetalleProducto";
import { ListaProductos } from "@/components/inventario/ListaProductos";
import { ModalAgregarUnidades, ModalAjuste } from "@/components/inventario/ModalesStock";
import { ModalProducto } from "@/components/inventario/ModalProducto";
import { Boton } from "@/components/ui/Boton";
import { Cargando, EncabezadoPagina, Vacio } from "@/components/ui/Basicos";
import { Confirmar } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { api } from "@/lib/http";
import { filtrosAUrl, leerFiltros, type FiltrosInventario } from "@/lib/inventario";
import type { NombreActivo, Producto } from "@/tipos";

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
        descripcion="Perfumes de tu local. Al vender, el stock se descuenta solo."
        acciones={
          <Boton icono="mas" onClick={() => setAccion({ tipo: "nuevo" })}>
            Agregar producto
          </Boton>
        }
      />

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
            ¿Seguro que deseas eliminar <strong>{eliminando?.nombre}</strong> del inventario? Las facturas anteriores no se afectan.
          </>
        }
        textoConfirmar="Sí, eliminar"
        peligro
        cargando={cargandoEliminar}
        onConfirmar={eliminar}
        onCerrar={() => setEliminando(null)}
      />
    </>
  );
}
