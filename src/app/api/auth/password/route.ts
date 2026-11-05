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
import { cambiarPassword } from "@/server/servicios/usuarios";

const esquema = cambiarPasswordSchema.and(z.object({ actual: z.string().min(1, "Escribe tu contraseña actual.") }));

export const PUT = manejador("AUTENTICADO", async ({ req, usuario }) => {
  const datos = await leerCuerpo(req, esquema);
  const registro = await db.query.usuarios.findFirst({ where: eq(usuarios.id, usuario.id) });
  if (!registro || !(await bcrypt.compare(datos.actual, registro.passwordHash))) {
    throw new ApiError(400, "La contraseña actual no es correcta.");
  }
  await cambiarPassword(usuario.id, datos.password);
  // La versión de sesión cambió: se crea una sesión nueva para no sacar al usuario
  await iniciarSesion({ id: registro.id, rol: registro.rol, versionSesion: registro.versionSesion + 1 });
  return ok({ mensaje: "Tu contraseña se cambió correctamente." });
});
