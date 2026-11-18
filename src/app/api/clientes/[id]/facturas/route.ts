/**
 * GET /api/clientes/:id/facturas?pagina=&estado= — Récord de facturas del cliente, de 10 en 10.
 * estado: COMPLETADA | PENDIENTE | ANULADA (sin estado: todas, también las anuladas).
 */
import { comoVendedor, manejador, ok } from "@/lib/api";
import { filtroFacturasClienteSchema, idSchema, parametros } from "@/lib/validaciones";
import { facturasDelCliente, obtenerCliente } from "@/server/servicios/clientes";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  await obtenerCliente(localId, id); // 404 si el cliente no es de este local
  const filtros = filtroFacturasClienteSchema.parse(parametros(req.nextUrl.searchParams));
  return ok(await facturasDelCliente(localId, id, filtros));
});
