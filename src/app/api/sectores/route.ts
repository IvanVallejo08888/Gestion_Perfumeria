/** GET /api/sectores — Sectores activos del local del vendedor (para la factura). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { listarSectores } from "@/server/servicios/sectores";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ sectores: await listarSectores(localId, { soloActivos: true }) });
});
