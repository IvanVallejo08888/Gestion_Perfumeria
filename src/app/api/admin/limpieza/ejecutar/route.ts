/**
 * POST /api/admin/limpieza/ejecutar — BORRA DEFINITIVAMENTE según el alcance.
 * Cuerpo: { localId, alcance, anio?, meses?, confirmacion, password, huella, reiniciarConsecutivo? }.
 * El servidor verifica la contraseña (bcrypt), la confirmación "BORRAR <LOCAL>", que no haya meses futuros,
 * la huella del respaldo y que los datos no hayan cambiado. Todo en una transacción. Solo administrador.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { ejecutarLimpiezaSchema } from "@/lib/validaciones";
import { ejecutarLimpieza } from "@/server/servicios/limpieza";

export const POST = manejador("ADMIN", async ({ req, usuario }) => {
  return ok(await ejecutarLimpieza(usuario, await leerCuerpo(req, ejecutarLimpiezaSchema)));
});
