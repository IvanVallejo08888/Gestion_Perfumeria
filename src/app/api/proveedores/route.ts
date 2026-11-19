/**
 * GET /api/proveedores?activos=1 — Proveedores del local con lo que se les debe (activos=1: solo los activos).
 * POST /api/proveedores — Nuevo proveedor.
 */
import { comoVendedor, leerCuerpo, manejador, ok } from "@/lib/api";
import { proveedorSchema } from "@/lib/validaciones";
import { crearProveedor, listarProveedores } from "@/server/servicios/proveedores";

export const GET = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  const soloActivos = req.nextUrl.searchParams.get("activos") === "1";
  return ok({ proveedores: await listarProveedores(localId, { soloActivos }) });
});

export const POST = manejador("VENDEDOR", async ({ req, usuario }) => {
  const { localId } = comoVendedor(usuario);
  return ok({ proveedor: await crearProveedor(localId, await leerCuerpo(req, proveedorSchema)) }, 201);
});
