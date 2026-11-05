import type { Metadata } from "next";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  const { expirada } = await searchParams;
  return <FormularioLogin sesionExpirada={expirada === "1"} />;
}
