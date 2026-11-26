/**
 * POST /api/auth/login — Inicia sesión con identificación y contraseña (admin y vendedores).
 * Protección contra fuerza bruta: tras varias contraseñas equivocadas se bloquea por un tiempo
 * esa identificación y, si son muchas, también la IP (ver servicios/limite-intentos.ts).
 */
import { ApiError, leerCuerpo, manejador, ok } from "@/lib/api";
import { iniciarSesion } from "@/lib/auth/sesion";
import { loginSchema } from "@/lib/validaciones";
import { ipDe, REGLAS, registrarIntento, reiniciarIntentos, verificarBloqueo } from "@/server/servicios/limite-intentos";
import { autenticar } from "@/server/servicios/usuarios";

export const POST = manejador("PUBLICO", async ({ req }) => {
  const { identificacion, password } = await leerCuerpo(req, loginSchema);
  const claveCuenta = `login:id:${identificacion}`;
  const claveIp = `login:ip:${ipDe(req)}`;

  await verificarBloqueo([claveCuenta, claveIp]);

  let usuario: Awaited<ReturnType<typeof autenticar>>;
  try {
    usuario = await autenticar(identificacion, password);
  } catch (error) {
    // Solo cuentan las contraseñas equivocadas (401). Una cuenta pausada o sin local
    // ya escribió bien su contraseña: no es un ataque.
    if (error instanceof ApiError && error.status === 401) {
      await Promise.all([
        registrarIntento(claveCuenta, REGLAS.loginPorCuenta),
        registrarIntento(claveIp, REGLAS.loginPorIp),
      ]);
      // Si este intento produjo el bloqueo, se avisa de una vez cuánto hay que esperar
      await verificarBloqueo([claveCuenta, claveIp]);
    }
    throw error;
  }

  // Entró bien: se olvidan los fallos de esa cuenta (los de la IP siguen contando)
  await reiniciarIntentos(claveCuenta);
  await iniciarSesion(usuario);
  // El navegador usa "destino" para llevar a cada rol a su panel
  return ok({ rol: usuario.rol, destino: usuario.rol === "ADMIN" ? "/admin" : "/panel/facturacion" });
});
