/**
 * POST /api/productos/duplicado — ¿Ya existe un producto con la misma marca, nombre, variante,
 * concentración y contenido? Responde { duplicado: { id, nombre } | null }.
 * Es solo una advertencia: el formulario permite continuar con confirmación.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { duplicadoProductoSchema } from "@/lib/validaciones";
import { buscarDuplicado } from "@/server/servicios/productos";

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const { excluirId, ...datos } = await leerCuerpo(req, duplicadoProductoSchema);
  return ok({ duplicado: await buscarDuplicado(localId, datos, excluirId) });
});
