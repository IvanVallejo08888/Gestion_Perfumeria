/**
 * Marco principal de la aplicación (después de iniciar sesión).
 * - Computador / tablet horizontal: menú lateral fijo.
 * - Celular / tablet vertical: barra superior con botón "Menú" que abre el menú completo.
 * - Para vendedores: contador de notificaciones que se actualiza cada minuto y,
 *   si la persona lo permite, avisos del navegador cuando hay cobros para hoy o vencidos.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/http";
import { ControlTexto } from "./ControlTexto";
import { Icono, type NombreIcono } from "../ui/Icono";

export interface ItemMenu {
  href: string;
  texto: string;
  icono: NombreIcono;
  /** Muestra el contador de notificaciones junto a este ítem */
  conContador?: boolean;
}

interface Props {
  items: ItemMenu[];
  nombreUsuario: string;
  subtitulo: string;
  notificaciones?: boolean;
  children: ReactNode;
}

const INTERVALO_NOTIFICACIONES_MS = 60_000;

export function Marco({ items, nombreUsuario, subtitulo, notificaciones = false, children }: Props) {
  const ruta = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [conteo, setConteo] = useState({ total: 0, urgentes: 0 });
  const ultimoAvisoRef = useRef<string | null>(null);

  // Cerrar el menú del celular al cambiar de página
  useEffect(() => setMenuAbierto(false), [ruta]);

  /* ---------- Consulta periódica de notificaciones (solo vendedores) ---------- */
  const consultar = useCallback(async () => {
    try {
      const datos = await api<{ total: number; urgentes: number; mensaje: string | null }>("/api/notificaciones/conteo");
      setConteo({ total: datos.total, urgentes: datos.urgentes });
      // Aviso del navegador (una sola vez por mensaje distinto)
      if (
        datos.mensaje &&
        datos.mensaje !== ultimoAvisoRef.current &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        ultimoAvisoRef.current = datos.mensaje;
        new Notification("Recordatorio de cobro", { body: datos.mensaje });
      }
    } catch {
      /* sin conexión: se vuelve a intentar en el siguiente minuto */
    }
  }, []);

  useEffect(() => {
    if (!notificaciones) return;
    consultar();
    const id = setInterval(consultar, INTERVALO_NOTIFICACIONES_MS);
    // Volver a consultar al regresar a la pestaña
    const alVolver = () => document.visibilityState === "visible" && consultar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("notificaciones:actualizar", consultar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("notificaciones:actualizar", consultar);
    };
  }, [notificaciones, consultar]);

  async function salir() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  const enlaces = (
    <nav aria-label="Menú principal">
      <ul className="space-y-1.5">
        {items.map((item) => {
          // "Inicio" del admin solo se marca en su propia página
          const activo = ruta === item.href || (item.href !== "/admin" && ruta.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-lg font-bold transition-colors ${
                  activo ? "bg-white text-marca-800 shadow" : "text-white hover:bg-white/15"
                }`}
              >
                <Icono nombre={item.icono} className="size-7" />
                <span className="flex-1">{item.texto}</span>
                {item.conContador && conteo.total > 0 && (
                  <span
                    className={`min-w-8 rounded-full px-2 py-0.5 text-center text-base font-bold ${
                      conteo.urgentes > 0 ? "bg-peligro-700 text-white" : "bg-alerta-50 text-alerta-800"
                    }`}
                  >
                    {conteo.total}
                    <span className="sr-only"> notificaciones{conteo.urgentes > 0 ? `, ${conteo.urgentes} urgentes` : ""}</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const pie = (
    <div className="space-y-4 border-t-2 border-white/20 pt-4">
      <div>
        <p className="text-base text-white/80">Tamaño de letra</p>
        <div className="mt-1">
          <ControlTexto claro />
        </div>
      </div>
      {notificaciones && <PermisoAvisos />}
      <button
        type="button"
        onClick={salir}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/70 text-lg font-bold text-white hover:bg-white/15"
      >
        <Icono nombre="salir" />
        Cerrar sesión
      </button>
    </div>
  );

  const cabecera = (
    <div className="mb-5">
      <p className="text-sm font-bold uppercase tracking-wide text-white/70">Gestión de Perfumerías</p>
      <p className="mt-1 text-xl font-bold text-white">{nombreUsuario}</p>
      <p className="text-base text-white/85">{subtitulo}</p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Menú lateral (pantallas grandes) */}
      <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col overflow-y-auto bg-marca-800 p-5 lg:flex">
        {cabecera}
        <div className="flex-1">{enlaces}</div>
        {pie}
      </aside>

      {/* Barra superior (celular y tablet) */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-marca-800 px-4 py-3 shadow-md lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{nombreUsuario}</p>
          <p className="truncate text-sm text-white/85">{subtitulo}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-expanded={menuAbierto}
          aria-controls="menu-movil"
          className="relative flex min-h-12 items-center gap-2 rounded-xl border-2 border-white/70 px-4 text-lg font-bold text-white"
        >
          <Icono nombre="menu" />
          Menú
          {notificaciones && conteo.urgentes > 0 && (
            <span className="absolute -right-2 -top-2 rounded-full bg-peligro-700 px-2 text-sm font-bold text-white">
              {conteo.urgentes}
            </span>
          )}
        </button>
      </header>

      {/* Menú desplegable (celular) */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" />
          <div id="menu-movil" className="absolute inset-y-0 right-0 flex w-[88vw] max-w-sm flex-col overflow-y-auto bg-marca-800 p-5">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-lg font-bold text-white hover:bg-white/15"
              >
                <Icono nombre="cerrar" />
                Cerrar
              </button>
            </div>
            {cabecera}
            <div className="flex-1">{enlaces}</div>
            <div className="mt-6">{pie}</div>
          </div>
        </div>
      )}

      <main id="contenido" className="min-w-0 flex-1 px-3 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Botón para activar los avisos del navegador (recordatorios de cobro). */
function PermisoAvisos() {
  // "null" mientras se verifica (evita diferencias entre servidor y navegador)
  const [permiso, setPermiso] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermiso(Notification.permission);
  }, []);
  if (permiso !== "default") return null;
  return (
    <button
      type="button"
      onClick={async () => setPermiso(await Notification.requestPermission())}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-base font-bold text-white hover:bg-white/25"
    >
      <Icono nombre="campana" />
      Activar avisos de cobro
    </button>
  );
}
