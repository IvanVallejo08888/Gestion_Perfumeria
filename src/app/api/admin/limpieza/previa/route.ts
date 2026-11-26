/**
 * POST /api/admin/limpieza/previa — Vista previa (dry-run): cuenta lo que se borraría y lo que se
 * conserva. NO modifica nada. Cuerpo: { localId, alcance, anio?, meses? }. Solo administrador.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { solicitudLimpiezaSchema } from "@/lib/validaciones";
import { vistaPrevia } from "@/server/servicios/limpieza";

export const POST = manejador("ADMIN", async ({ req }) => {
  return ok(await vistaPrevia(await leerCuerpo(req, solicitudLimpiezaSchema)));
});
