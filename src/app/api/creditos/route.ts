/**
 * GET /api/creditos?q= — Créditos del local.
 * Sin búsqueda: todos los PENDIENTES. Con búsqueda (ID, celular o nombre, parcial): todos los créditos que coinciden.
 * ?identificacion= se sigue aceptando (enlaces desde Notificaciones).
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { filtroCreditosSchema, parametros } from "@/lib/validaciones";
import { listarCreditos } from "@/server/servicios/creditos";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { q, identificacion } = filtroCreditosSchema.parse(parametros(req.nextUrl.searchParams));
  return ok({ creditos: await listarCreditos(localId, q || identificacion) });
});
