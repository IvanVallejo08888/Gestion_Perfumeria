/** POST /api/auth/login — Inicia sesión con identificación y contraseña (admin y vendedores). */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { iniciarSesion } from "@/lib/auth/sesion";
import { loginSchema } from "@/lib/validaciones";
import { autenticar } from "@/server/servicios/usuarios";

export const POST = manejador("PUBLICO", async ({ req }) => {
  const { identificacion, password } = await leerCuerpo(req, loginSchema);
  const usuario = await autenticar(identificacion, password);
  await iniciarSesion(usuario);
  // El navegador usa "destino" para llevar a cada rol a su panel
  return ok({ rol: usuario.rol, destino: usuario.rol === "ADMIN" ? "/admin" : "/panel/facturacion" });
});
