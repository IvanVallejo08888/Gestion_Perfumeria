/**
 * Cliente HTTP para el navegador.
 * Llama a la API y, si hay error, lanza un Error con el mensaje en español
 * que devolvió el servidor (listo para mostrarlo en pantalla).
 */
"use client";

export async function api<T = unknown>(url: string, opciones: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...resto } = opciones;
  const respuesta = await fetch(url, {
    ...resto,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : resto.body,
    cache: "no-store",
  });

  // Sesión vencida o cuenta pausada: volver al inicio de sesión
  if (respuesta.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    window.location.href = "/login?expirada=1";
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error((datos as { error?: string }).error ?? "No se pudo completar la acción.");
  }
  return datos as T;
}
