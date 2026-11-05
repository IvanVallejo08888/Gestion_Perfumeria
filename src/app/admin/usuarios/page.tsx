import { GestionUsuarios } from "./GestionUsuarios";

export const metadata = { title: "Usuarios" };

export default async function PaginaUsuarios({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  return <GestionUsuarios estadoInicial={estado ?? ""} />;
}
