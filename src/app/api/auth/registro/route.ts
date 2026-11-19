/**
 * POST /api/auth/registro — Crea una cuenta de vendedor en estado PENDIENTE (espera asignación de local).
 * Para frenar la creación masiva de cuentas falsas, cada IP tiene un número limitado de intentos por hora.
 */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { registroSchema } from "@/lib/validaciones";
import { ipDe, REGLAS, registrarIntento, verificarBloqueo } from "@/server/servicios/limite-intentos";
import { registrarUsuario } from "@/server/servicios/usuarios";

export const POST = manejador("PUBLICO", async ({ req }) => {
  const datos = await leerCuerpo(req, registroSchema);
  const claveIp = `registro:ip:${ipDe(req)}`;

  await verificarBloqueo([claveIp]);
  // Cuenta todo intento que llega a la base de datos, también los de datos repetidos:
  // así nadie puede probar miles de identificaciones para saber cuáles ya existen.
  await registrarIntento(claveIp, REGLAS.registroPorIp);

  await registrarUsuario(datos);
  return ok(
    { mensaje: "Cuenta creada. Espera a que el administrador te asigne un local para poder ingresar." },
    201,
  );
});
