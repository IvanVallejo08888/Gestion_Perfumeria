/**
 * Registra el service worker (solo en producción) y avisa cuando hay una versión nueva.
 * Va en el layout raíz para funcionar en todas las pantallas, también antes de iniciar sesión.
 */
"use client";

import { useEffect, useState } from "react";
import { Boton } from "../ui/Boton";
import { Mensaje } from "../ui/Basicos";

export function RegistroPWA() {
  const [nuevaVersion, setNuevaVersion] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;

    if (process.env.NODE_ENV !== "production") {
      // En "npm run dev" los archivos cambian sin cambiar de nombre: un service worker que
      // haya quedado de "npm run start" mostraría código viejo, así que se elimina
      void limpiarServiceWorker();
      return;
    }

    // La primera instalación también toma control de la página: eso no debe causar una recarga
    const habiaControlador = Boolean(sw.controller);
    let recargando = false;
    const alCambiarControlador = () => {
      if (!habiaControlador || recargando) return;
      recargando = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", alCambiarControlador);

    /** Sigue a un service worker nuevo hasta que queda instalado y en espera. */
    const seguir = (trabajador: ServiceWorker | null) => {
      trabajador?.addEventListener("statechange", () => {
        if (trabajador.state === "installed" && sw.controller) setNuevaVersion(trabajador);
      });
    };

    sw.register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_VERSION_APP ?? "")}`)
      .then((registro) => {
        if (registro.waiting && sw.controller) setNuevaVersion(registro.waiting);
        seguir(registro.installing);
        registro.addEventListener("updatefound", () => seguir(registro.installing));
      })
      .catch(() => {
        /* la app sigue funcionando normalmente, solo que sin instalación ni modo sin conexión */
      });

    return () => sw.removeEventListener("controllerchange", alCambiarControlador);
  }, []);

  if (!nuevaVersion) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[150] mx-auto max-w-lg space-y-3 rounded-2xl bg-tarjeta p-3 shadow-2xl">
      <Mensaje tono="marca" titulo="Hay una nueva versión disponible" />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={() => setNuevaVersion(null)}>
          Más tarde
        </Boton>
        <Boton icono="descargar" onClick={() => nuevaVersion.postMessage({ tipo: "ACTUALIZAR_AHORA" })}>
          Actualizar ahora
        </Boton>
      </div>
    </div>
  );
}

async function limpiarServiceWorker() {
  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registros.map((registro) => registro.unregister()));
  const nombres = await caches.keys();
  await Promise.all(nombres.filter((nombre) => nombre.startsWith("perfumerias-")).map((nombre) => caches.delete(nombre)));
}
