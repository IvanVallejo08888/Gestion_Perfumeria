/** GET /api/clientes/sugerencias?nombre= — Sugerencias de clientes del local por nombre (para la factura). */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { busquedaClienteSchema, parametros } from "@/lib/validaciones";
import { buscarClientesPorNombre } from "@/server/servicios/clientes";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { nombre } = busquedaClienteSchema.parse(parametros(req.nextUrl.searchParams));
  return ok({ clientes: await buscarClientesPorNombre(localId, nombre) });
});
