/** GET /api/clientes/:identificacion — Datos de un cliente ya registrado (para autocompletar la factura). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { buscarClientePorIdentificacion } from "@/server/servicios/clientes";

export const GET = manejador<{ identificacion: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ cliente: await buscarClientePorIdentificacion(localId, decodeURIComponent(params.identificacion)) });
});
