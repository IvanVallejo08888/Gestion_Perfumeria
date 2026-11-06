/** GET /api/gastos/categorias — Categorías activas del local del vendedor. */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarCategorias } from "@/server/servicios/gastos";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ categorias: await listarCategorias(localId, { soloActivas: true }) });
});
