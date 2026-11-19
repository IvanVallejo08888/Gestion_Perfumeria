/**
 * GET /api/clientes/:id — Datos del cliente y resumen de su récord (sin contar ventas anuladas).
 * PUT /api/clientes/:id — Editar nombre, cédula, teléfono, dirección y sector.
 *   Las facturas antiguas no cambian (guardan los datos del día de la venta).
 * Solo clientes del local del vendedor.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { clienteSchema, idSchema } from "@/lib/validaciones";
import { editarCliente, obtenerCliente, resumenCliente } from "@/server/servicios/clientes";

export const GET = manejador<{ id: string }>("VENDEDOR", async ({ usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const cliente = await obtenerCliente(localId, id);
  return ok({ cliente, resumen: await resumenCliente(localId, id) });
});

export const PUT = manejador<{ id: string }>("VENDEDOR", async ({ req, usuario, params }) => {
  const { localId } = comoVendedor(usuario);
  const id = idSchema.parse(params.id);
  const datos = await leerCuerpo(req, clienteSchema);
  return ok({ cliente: await editarCliente(localId, id, datos) });
});
