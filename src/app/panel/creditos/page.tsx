import { GestionCreditos } from "./GestionCreditos";

export const metadata = { title: "Créditos y abonos" };

/** Acepta ?identificacion= para abrir directamente los créditos de un cliente (desde Notificaciones). */
export default async function PaginaCreditos({ searchParams }: { searchParams: Promise<{ identificacion?: string }> }) {
  const { identificacion } = await searchParams;
  return <GestionCreditos identificacionInicial={identificacion?.replace(/\D/g, "") ?? ""} />;
}
