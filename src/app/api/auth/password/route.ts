/**
 * PUT /api/auth/password — El usuario conectado cambia su propia contraseña.
 * Pide la contraseña actual por seguridad. Después de cambiarla, se renueva la sesión.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ApiError, leerCuerpo, manejador, ok } from "@/lib/api";
import { iniciarSesion } from "@/lib/auth/sesion";
import { cambiarPasswordSchema } from "@/lib/validaciones";
import { REGLAS, registrarIntento, reiniciarIntentos, verificarBloqueo } from "@/server/servicios/limite-intentos";
import { cambiarPassword } from "@/server/servicios/usuarios";

const esquema = cambiarPasswordSchema.and(z.object({ actual: z.string().min(1, "Escribe tu contraseña actual.") }));

export const PUT = manejador("AUTENTICADO", async ({ req, usuario }) => {
  const datos = await leerCuerpo(req, esquema);
  // Si alguien deja la sesión abierta, no debe poder adivinar la contraseña actual a punta de intentos
  const clave = `password:usuario:${usuario.id}`;
  await verificarBloqueo([clave]);

  const registro = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuario.id) });
  if (!registro || !(await bcrypt.compare(datos.actual, registro.passwordHash))) {
    await registrarIntento(clave, REGLAS.passwordPorUsuario);
    await verificarBloqueo([clave]);
    throw new ApiError(400, "La contraseña actual no es correcta.");
  }
  await reiniciarIntentos(clave);
  await cambiarPassword(usuario.id, datos.password);
  // La versión de sesión cambió: se crea una sesión nueva para no sacar al usuario
  await iniciarSesion({ id: registro.id, rol: registro.rol, versionSesion: registro.versionSesion + 1 });
  return ok({ mensaje: "Tu contraseña se cambió correctamente." });
});
