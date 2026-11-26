/**
 * GET /api/clientes/buscar-identificacion?identificacion= — Cliente registrado con esa cédula
 * (para autocompletar la factura). Responde { cliente, otroLocal }: primero busca en el local
 * del vendedor; si no está, en otro local (otroLocal = true, solo sus datos, sin historial).
 * Antes era /api/clientes/:identificacion; se movió porque chocaba con /api/clientes/:id.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { buscarClientePorIdentificacion } from "@/server/servicios/clientes";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const identificacion = (req.nextUrl.searchParams.get("identificacion") ?? "").slice(0, 40);
  return ok(await buscarClientePorIdentificacion(localId, identificacion));
});
