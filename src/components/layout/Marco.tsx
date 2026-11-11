/**
 * Marco principal de la aplicación (después de iniciar sesión).
 * - Computador / tablet horizontal: menú lateral que se oculta o muestra con el botón de la barra
 *   superior; la preferencia se guarda en este navegador (localStorage).
 * - Celular / tablet vertical: barra superior compacta con botón que desliza el menú desde la izquierda.
 * - Para vendedores: contador de notificaciones que se actualiza cada minuto y,
 *   si la persona lo permite, avisos del navegador cuando hay cobros para hoy o vencidos.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useIntervalo } from "@/hooks/useIntervalo";
import { useAlCambiarNotificaciones } from "@/hooks/useNotificaciones";
import { api } from "@/lib/http";
import { BotonInstalar } from "../pwa/BotonInstalar";
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
const ETIQUETA_COBRO = "recordatorio-cobro";
const CLAVE_LATERAL = "menu-lateral-abierto";

export function Marco({ items, nombreUsuario, subtitulo, notificaciones = false, children }: Props) {
  const ruta = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [lateralAbierta, setLateralAbierta] = useState(true);
  // La transición se activa después de leer la preferencia, para que al recargar no se vea cerrarse
  const [lateralListo, setLateralListo] = useState(false);
  const [conteo, setConteo] = useState({ total: 0, urgentes: 0 });
  const ultimoAvisoRef = useRef<string | null>(null);

  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const botonCerrarRef = useRef<HTMLButtonElement>(null);
  const panelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_LATERAL) === "0") setLateralAbierta(false);
    } catch {
      /* almacenamiento bloqueado: se queda abierto */
    }
    const id = requestAnimationFrame(() => setLateralListo(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function alternarLateral() {
    setLateralAbierta((abierta) => {
      try {
        localStorage.setItem(CLAVE_LATERAL, abierta ? "0" : "1");
      } catch {
        /* sin almacenamiento: solo dura mientras la página está abierta */
      }
      return !abierta;
    });
  }

  // Cerrar el menú del celular al cambiar de página
  useEffect(() => setMenuAbierto(false), [ruta]);

  /*
   * Menú del celular accesible con teclado (WCAG 2.1.2 y 2.4.3):
   * al abrir, el foco pasa al botón «Cerrar»; Esc lo cierra; Tab no se sale del menú;
   * al cerrar, el foco vuelve al botón «Menú».
   */
  useEffect(() => {
    if (!menuAbierto) return;
    botonCerrarRef.current?.focus();
    const botonMenu = botonMenuRef.current;
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuAbierto(false);
        return;
      }
      if (e.key !== "Tab" || !panelMenuRef.current) return;
      const enfocables = panelMenuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero?.focus();
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      botonMenu?.focus();
    };
  }, [menuAbierto]);

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
        await mostrarNotificacion("Recordatorio de cobro", datos.mensaje);
      }
    } catch {
      /* sin conexión: se vuelve a intentar en el siguiente minuto */
    }
  }, []);

  useEffect(() => {
    if (notificaciones) consultar();
  }, [notificaciones, consultar]);
  // Cada minuto y al regresar a la pestaña
  useIntervalo(consultar, INTERVALO_NOTIFICACIONES_MS, { activo: notificaciones, alVolver: true });
  // Cuando otra pantalla avisa que algo cambió (venta, abono, stock…)
  useAlCambiarNotificaciones(consultar, notificaciones);

  async function salir() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    await cerrarNotificaciones().catch(() => {});
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
                  activo ? "bg-perla text-marca-800 shadow" : "text-white hover:bg-white/10"
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
    <div className="space-y-4 border-t border-champan/50 pt-4">
      <div>
        <p className="text-base text-white/80">Tamaño de letra</p>
        <div className="mt-1">
          <ControlTexto claro />
        </div>
      </div>
      <BotonInstalar claro />
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
      <p className="font-titulo text-lg font-semibold uppercase tracking-[0.12em] text-champan">Gestión de Perfumerías</p>
      <p className="mt-1 text-xl font-bold text-white">{nombreUsuario}</p>
      <p className="text-base text-white/85">{subtitulo}</p>
    </div>
  );

  const etiquetaLateral = lateralAbierta ? "Ocultar menú lateral" : "Mostrar menú lateral";

  return (
    <div className="min-h-dvh lg:flex">
      {/* Menú lateral (pantallas grandes). Se oculta encogiendo el ancho a 0; el contenido interno conserva su ancho. */}
      <aside
        id="menu-lateral"
        inert={!lateralAbierta}
        className={`zona-oscura sticky top-0 hidden h-dvh shrink-0 overflow-hidden bg-marca-800 lg:block ${
          lateralListo ? "transition-[width] duration-250 ease-out" : ""
        } ${lateralAbierta ? "w-80" : "w-0"}`}
      >
        <div className="flex h-full w-80 flex-col overflow-y-auto p-5">
          {cabecera}
          <div className="flex-1">{enlaces}</div>
          {pie}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior: en celular abre el menú deslizable; en escritorio oculta o muestra el menú lateral */}
        <header className="zona-oscura sticky top-0 z-40 flex min-h-14 items-center gap-2 bg-marca-800 px-2 py-1 shadow-md sm:px-3 lg:px-4">
          <button
            ref={botonMenuRef}
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label="Abrir menú"
            className="relative flex size-12 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/15 lg:hidden"
          >
            <Icono nombre="menu" className="size-7" />
            {notificaciones && conteo.urgentes > 0 && (
              <span className="absolute -right-1 -top-1 min-w-6 rounded-full border-2 border-white bg-peligro-700 px-1 text-center text-sm leading-5 font-bold text-white">
                {conteo.urgentes}
                <span className="sr-only"> cobros urgentes</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={alternarLateral}
            aria-expanded={lateralAbierta}
            aria-controls="menu-lateral"
            aria-label={etiquetaLateral}
            title={etiquetaLateral}
            className="hidden size-12 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/15 lg:flex"
          >
            <Icono nombre="menu" className="size-7" />
          </button>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold text-white">{nombreUsuario}</p>
            <p className="truncate text-sm text-white/85">{subtitulo}</p>
          </div>
        </header>

        <main id="contenido" className="min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Menú deslizable (celular y tablet): siempre montado para animar la entrada y la salida */}
      <div className={`fixed inset-0 z-50 lg:hidden ${menuAbierto ? "" : "pointer-events-none"}`} inert={!menuAbierto}>
        {/* Fondo oscuro: se cierra al tocarlo, pero no recibe foco (ya existe el botón «Cerrar») */}
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-250 ease-out ${menuAbierto ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
        <div
          ref={panelMenuRef}
          id="menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={`zona-oscura absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col overflow-y-auto bg-marca-800 p-5 shadow-2xl transition-transform duration-250 ease-out ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-3 flex justify-end">
            <button
              ref={botonCerrarRef}
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
    </div>
  );
}

/**
 * Muestra un aviso con el service worker si ya está activo. En Android, con la app instalada,
 * `new Notification` falla: solo sirve como respaldo (por ejemplo, en "npm run dev").
 * La etiqueta hace que cada aviso reemplace al anterior en vez de acumularse.
 */
async function mostrarNotificacion(titulo: string, cuerpo: string) {
  const registro = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registro?.active) {
    await registro.showNotification(titulo, { body: cuerpo, icon: "/icons/icon-192.png", tag: ETIQUETA_COBRO });
  } else {
    new Notification(titulo, { body: cuerpo });
  }
}

/** Al salir se quitan los avisos: en un dispositivo compartido, el siguiente vendedor no debe verlos. */
async function cerrarNotificaciones() {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.getRegistration();
  const avisos = await registro?.getNotifications({ tag: ETIQUETA_COBRO });
  avisos?.forEach((aviso) => aviso.close());
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
