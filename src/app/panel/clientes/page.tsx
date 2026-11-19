import { Suspense } from "react";
import { Cargando } from "@/components/ui/Basicos";
import { ListaClientes } from "./ListaClientes";

export const metadata = { title: "Clientes" };

/** Lista de clientes del local. La búsqueda y la página se leen de la URL (?q=&pagina=&cliente=). */
export default function PaginaClientes() {
  return (
    <Suspense fallback={<Cargando />}>
      <ListaClientes />
    </Suspense>
  );
}
