/**
 * GET /api/marcas — Marcas activas del local del vendedor (para crear o editar productos).
 * POST — El vendedor agrega una marca a su local desde el formulario de producto.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { nuevaMarcaSchema } from "@/lib/validaciones";
import { crearMarcaDelLocal, listarMarcas } from "@/server/servicios/marcas";

export const GET = manejador("VENDEDOR", async ({ usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ marcas: await listarMarcas(localId, { soloActivas: true }) });
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { nombre } = await leerCuerpo(req, nuevaMarcaSchema);
  const marca = await crearMarcaDelLocal(localId, nombre);
  return ok({ marca }, marca.existia ? 200 : 201);
});
