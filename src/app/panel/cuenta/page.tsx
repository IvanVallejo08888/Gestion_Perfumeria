import { redirect } from "next/navigation";
import { Ajustes } from "@/components/compartidos/Ajustes";
import { obtenerUsuarioSesion } from "@/lib/auth/sesion";

export const metadata = { title: "Ajustes" };

export default async function AjustesVendedor() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) redirect("/api/auth/logout");
  return <Ajustes usuario={{ nombre: usuario.nombre, rol: usuario.rol, localNombre: usuario.localNombre }} />;
}
