/** Inicio del administrador: resumen rápido y accesos directos. */
import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { EncabezadoPagina, Mensaje } from "@/components/ui/Basicos";
import { listarLocales } from "@/server/servicios/locales";
import { contarUsuariosPorEstado } from "@/server/servicios/usuarios";

export const metadata = { title: "Inicio" };

export default async function InicioAdmin() {
  const [usuarios, locales] = await Promise.all([contarUsuariosPorEstado(), listarLocales()]);
  const activos = locales.filter((l) => l.activo).length;

  const tarjetas: { href: string; icono: NombreIcono; titulo: string; valor: string; detalle: string }[] = [
    { href: "/admin/usuarios?estado=PENDIENTE", icono: "usuarios", titulo: "Usuarios en espera", valor: String(usuarios.PENDIENTE), detalle: "Necesitan que les asignes un local" },
    { href: "/admin/usuarios", icono: "cuenta", titulo: "Usuarios activos", valor: String(usuarios.ACTIVO), detalle: `${usuarios.PAUSADO} en pausa` },
    { href: "/admin/locales", icono: "local", titulo: "Locales", valor: String(locales.length), detalle: `${activos} activos` },
    { href: "/admin/reportes", icono: "reporte", titulo: "Reportes", valor: "Excel", detalle: "Por año y por mes de cada local" },
  ];

  return (
    <>
      <EncabezadoPagina titulo="Panel del administrador" descripcion="Desde aquí gestionas usuarios, locales y reportes." />

      {usuarios.PENDIENTE > 0 && (
        <div className="mb-6">
          <Mensaje tono="alerta" titulo={`Tienes ${usuarios.PENDIENTE} ${usuarios.PENDIENTE === 1 ? "usuario esperando" : "usuarios esperando"} un local`}>
            <Link href="/admin/usuarios?estado=PENDIENTE" className="font-bold underline underline-offset-4">
              Asignar locales ahora
            </Link>
          </Mensaje>
        </div>
      )}
      {locales.length === 0 && (
        <div className="mb-6">
          <Mensaje tono="info" titulo="Primer paso: crea tu primer local">
            <Link href="/admin/locales" className="font-bold underline underline-offset-4">
              Ir a Locales
            </Link>
          </Mensaje>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map((t) => (
          <Link
            key={t.titulo}
            href={t.href}
            className="group rounded-2xl border border-linea bg-white p-5 shadow-sm transition hover:border-marca-700 hover:shadow-md"
          >
            <div className="flex items-center gap-3 text-marca-700">
              <Icono nombre={t.icono} className="size-8" />
              <span className="text-lg font-bold text-texto">{t.titulo}</span>
            </div>
            <p className="mt-3 text-4xl font-bold text-marca-800">{t.valor}</p>
            <p className="mt-1 text-base text-texto-suave">{t.detalle}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
