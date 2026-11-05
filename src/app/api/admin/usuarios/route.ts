/** GET /api/admin/usuarios?estado=&texto= — Lista de vendedores (los pendientes aparecen primero). */
import { manejador, ok } from "@/lib/api";
import { listarUsuarios } from "@/server/servicios/usuarios";

export const GET = manejador("ADMIN", async ({ req }) => {
  const url = req.nextUrl.searchParams;
  const usuarios = await listarUsuarios({
    estado: url.get("estado") ?? undefined,
    texto: url.get("texto") ?? undefined,
  });
  return ok({ usuarios });
});
