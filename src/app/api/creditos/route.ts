/**
 * GET /api/creditos?identificacion= — Créditos del local.
 * Sin identificación: todos los PENDIENTES. Con identificación: todos los créditos de ese cliente.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarCreditos } from "@/server/servicios/creditos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const identificacion = req.nextUrl.searchParams.get("identificacion") ?? undefined;
  return ok({ creditos: await listarCreditos(localId, identificacion) });
});
