/** GET /api/deudas/acreedores — Sugerencias para «¿A quién le debes?»: acreedores ya usados y proveedores activos del local. */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { sugerenciasAcreedores } from "@/server/servicios/deudas";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ acreedores: await sugerenciasAcreedores(localId) });
});
