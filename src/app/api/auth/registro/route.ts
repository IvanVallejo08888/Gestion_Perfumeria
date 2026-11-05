/** POST /api/auth/registro — Crea una cuenta de vendedor en estado PENDIENTE (espera asignación de local). */
import { leerCuerpo, manejador, ok } from "@/lib/api";
import { registroSchema } from "@/lib/validaciones";
import { registrarUsuario } from "@/server/servicios/usuarios";

export const POST = manejador("PUBLICO", async ({ req }) => {
  const datos = await leerCuerpo(req, registroSchema);
  await registrarUsuario(datos);
  return ok(
    { mensaje: "Cuenta creada. Espera a que el administrador te asigne un local para poder ingresar." },
    201,
  );
});
