/** GET /api/marcas — Marcas activas del local del vendedor (para crear o editar productos). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarMarcas } from "@/server/servicios/marcas";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ marcas: await listarMarcas(localId, { soloActivas: true }) });
});
