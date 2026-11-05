import type { Metadata } from "next";
import { FormularioRegistro } from "./FormularioRegistro";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
  return <FormularioRegistro />;
}
