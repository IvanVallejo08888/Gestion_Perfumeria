/**
 * Service worker de Gestión de Perfumerías (escrito a mano, sin next-pwa).
 *
 * SEGURIDAD: varios vendedores pueden usar el mismo dispositivo, así que aquí se trabaja
 * con una LISTA DE PERMITIDOS. Solo se guardan en caché los archivos estáticos públicos
 * (/_next/static, íconos y fuentes) y la página /offline. Todo lo demás, incluidos /api/*,
 * las páginas con datos del usuario y las descargas de Excel o PDF, va directo a la red.
 * Las respuestas de red de las páginas NUNCA se escriben en caché.
 */

/**
 * La versión la entrega RegistroPWA en la dirección (/sw.js?v=...) y cambia con cada
 * compilación: así cada publicación instala un service worker nuevo y aparece el aviso
 * "Hay una nueva versión disponible" sin tener que editar este archivo a mano.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "sin-version";
const PREFIJO_CACHE = "perfumerias-";
const CACHE_ESTATICOS = `${PREFIJO_CACHE}${VERSION}`;

const PAGINA_OFFLINE = "/offline";
const DESTINO_NOTIFICACION = "/panel/notificaciones";
const HOSTS_FUENTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

/* ---------- Instalación: deja lista la página sin conexión ---------- */
self.addEventListener("install", (evento) => {
  // No se llama a skipWaiting aquí: la versión nueva espera a que la persona toque "Actualizar ahora"
  evento.waitUntil(guardarPaginaOffline());
});

async function guardarPaginaOffline() {
  // Sin cookies: la copia guardada nunca puede depender de la sesión de quien la descargó
  const respuesta = await fetch(PAGINA_OFFLINE, { credentials: "omit", cache: "reload" });
  if (!respuesta.ok || respuesta.redirected) throw new Error("No se pudo preparar la página sin conexión");

  const cache = await caches.open(CACHE_ESTATICOS);
  const html = await respuesta.clone().text();
  await cache.put(PAGINA_OFFLINE, respuesta);

  // Los estilos y scripts de esa página también se guardan: sin ellos se vería sin diseño
  // y el botón "Reintentar" no funcionaría (en la primera visita aún no pasan por este archivo)
  const recursos = new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || []);
  await Promise.allSettled([...recursos].map((ruta) => cache.add(ruta)));
}

/* ---------- Activación: borra cachés de versiones anteriores ---------- */
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith(PREFIJO_CACHE) && nombre !== CACHE_ESTATICOS)
          .map((nombre) => caches.delete(nombre)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ---------- "Actualizar ahora" (viene de RegistroPWA) ---------- */
self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "ACTUALIZAR_AHORA") self.skipWaiting();
});

/* ---------- Peticiones ---------- */
self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (HOSTS_FUENTES.includes(url.hostname)) {
    evento.respondWith(primeroCache(request, url.href, { mode: "cors", credentials: "omit" }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Regla de seguridad: API y descargas nunca pasan por la caché (ni como navegación)
  if (esApi(url) || esDescarga(url)) return;

  if (request.mode === "navigate") {
    evento.respondWith(redPrimeroSinGuardar(request));
    return;
  }

  if (esEstatico(url)) evento.respondWith(primeroCache(request, request));

  // Cualquier otra petición (por ejemplo, las de cambio de página de Next.js con ?_rsc=,
  // que traen datos del usuario) no se intercepta: la atiende el navegador directamente.
});

const esApi = (url) => url.pathname === "/api" || url.pathname.startsWith("/api/");

const esDescarga = (url) => /\.(xlsx|xls|pdf|csv)$/i.test(url.pathname);

const esEstatico = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon.svg";

/** Cache-first: responde con la copia guardada y, si no existe, la descarga y la guarda. */
async function primeroCache(clave, peticion, opcionesFetch) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const guardada = await cache.match(clave, { ignoreVary: true });
  if (guardada) return guardada;

  const respuesta = await fetch(peticion, opcionesFetch);
  // Solo respuestas correctas: un error guardado aquí quedaría fijo hasta la siguiente versión
  if (respuesta.ok) await cache.put(clave, respuesta.clone()).catch(() => {});
  return respuesta;
}

/** Network-first para páginas: la respuesta no se guarda; sin conexión se muestra /offline. */
async function redPrimeroSinGuardar(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_ESTATICOS);
    return (await cache.match(PAGINA_OFFLINE)) || Response.error();
  }
}

/* ---------- Toque en una notificación: abre o enfoca /panel/notificaciones ---------- */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(abrirNotificaciones());
});

async function abrirNotificaciones() {
  const destino = new URL(DESTINO_NOTIFICACION, self.location.origin).href;
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  const yaAbierta = ventanas.find((ventana) => ventana.url === destino);
  if (yaAbierta) return yaAbierta.focus();

  const [ventana] = ventanas;
  if (ventana) {
    try {
      const enfocada = await ventana.focus();
      return await enfocada.navigate(destino);
    } catch {
      /* la ventana no se pudo reutilizar: se abre una nueva */
    }
  }
  return self.clients.openWindow(destino);
}

/*
 * TODO (Web Push en segundo plano): hoy los avisos solo llegan con la app abierta, porque
 * Marco.tsx consulta /api/notificaciones/conteo cada minuto. Para recibirlos con la app
 * cerrada haría falta:
 *  1. Claves VAPID: generarlas y guardarlas en variables de entorno (la privada solo en el servidor).
 *  2. Suscripciones en BD: pedir pushManager.subscribe() en el navegador y guardar endpoint y
 *     claves por usuario y dispositivo. Al cerrar sesión hay que borrarlas: si el dispositivo
 *     es compartido, otro vendedor no debe recibir los cobros de quien salió.
 *  3. Envío desde el servidor: una tarea programada que revise los cobros y envíe el mensaje
 *     cifrado (por ejemplo, con la librería web-push), eliminando las suscripciones vencidas.
 *  4. Aquí: atender el evento "push" y llamar a self.registration.showNotification().
 */
