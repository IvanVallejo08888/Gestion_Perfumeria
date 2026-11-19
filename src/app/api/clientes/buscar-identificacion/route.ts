/**
 * GET /api/clientes/buscar-identificacion?identificacion= — Datos de un cliente ya registrado
 * (para autocompletar la factura). Antes era /api/clientes/:identificacion; se movió porque
 * chocaba con /api/clientes/:id.
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { buscarClientePorIdentificacion } from "@/server/servicios/clientes";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const identificacion = req.nextUrl.searchParams.get("identificacion")?.trim() ?? "";
  return ok({ cliente: identificacion ? await buscarClientePorIdentificacion(localId, identificacion) : null });
});
