import { GestionCreditos } from "./GestionCreditos";

export const metadata = { title: "Créditos y abonos" };

/** Acepta ?identificacion= (desde Notificaciones) o ?q= para abrir directamente la búsqueda de un cliente. */
export default async function PaginaCreditos({ searchParams }: { searchParams: Promise<{ identificacion?: string; q?: string }> }) {
  const { identificacion, q } = await searchParams;
  return <GestionCreditos busquedaInicial={(q ?? identificacion ?? "").trim().slice(0, 100)} />;
}
