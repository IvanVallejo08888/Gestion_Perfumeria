import { redirect } from "next/navigation";
import { Marco, type ItemMenu } from "@/components/layout/Marco";
import { obtenerUsuarioSesion } from "@/lib/auth/sesion";

/** Menú de cada vendedor (todas las secciones trabajan sobre SU local) */
const MENU: ItemMenu[] = [
  { href: "/panel/facturacion", texto: "Facturación", icono: "factura" },
  { href: "/panel/historial", texto: "Historial de ventas", icono: "historial" },
  { href: "/panel/creditos", texto: "Créditos y abonos", icono: "credito" },
  { href: "/panel/gastos", texto: "Gastos", icono: "dinero" },
  { href: "/panel/notificaciones", texto: "Notificaciones", icono: "campana", conContador: true },
  { href: "/panel/inventario", texto: "Inventario", icono: "inventario" },
  { href: "/panel/reportes", texto: "Reportes y estadísticas", icono: "reporte" },
  { href: "/panel/cuenta", texto: "Mi cuenta", icono: "cuenta" },
];

export const dynamic = "force-dynamic";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await obtenerUsuarioSesion();
  // Si la cuenta fue pausada, eliminada o cambió su contraseña, se cierra la sesión
  if (!usuario || usuario.rol !== "VENDEDOR") redirect("/api/auth/logout");

  return (
    <Marco items={MENU} nombreUsuario={usuario.nombre} subtitulo={`Local: ${usuario.localNombre ?? "—"}`} notificaciones>
      {children}
    </Marco>
  );
}
