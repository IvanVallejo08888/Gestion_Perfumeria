import { redirect } from "next/navigation";
import { Marco, type ItemMenu } from "@/components/layout/Marco";
import { obtenerUsuarioSesion } from "@/lib/auth/sesion";

/** Menú del administrador */
const MENU: ItemMenu[] = [
  { href: "/admin", texto: "Inicio", icono: "inicio" },
  { href: "/admin/usuarios", texto: "Usuarios", icono: "usuarios" },
  { href: "/admin/locales", texto: "Locales", icono: "local" },
  { href: "/admin/reportes", texto: "Reportes", icono: "reporte" },
  { href: "/admin/cuenta", texto: "Ajustes", icono: "ajustes" },
];

// Siempre se valida la sesión contra la base de datos (nada en caché)
export const dynamic = "force-dynamic";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario || usuario.rol !== "ADMIN") redirect("/api/auth/logout");

  return (
    <Marco items={MENU} nombreUsuario={usuario.nombre} subtitulo="Administrador">
      {children}
    </Marco>
  );
}
