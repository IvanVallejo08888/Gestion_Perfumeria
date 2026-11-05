import { redirect } from "next/navigation";
import { obtenerUsuarioSesion } from "@/lib/auth/sesion";

/** Página raíz: envía a cada persona a su panel, o al inicio de sesión. */
export default async function Inicio() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) redirect("/login");
  redirect(usuario.rol === "ADMIN" ? "/admin" : "/panel/facturacion");
}
