import type { Metadata } from "next";
import { Mensaje } from "@/components/ui/Basicos";
import { BotonReintentar } from "./BotonReintentar";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };

// Página fija y sin datos de nadie: es la única que guarda el service worker
export const dynamic = "force-static";

export default function PaginaSinConexion() {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="border-b-2 border-champan bg-menu px-4 py-4 shadow-md sm:px-8">
        <p className="font-titulo text-xl font-bold uppercase tracking-[0.12em] text-champan sm:text-2xl">Gestión de Perfumerías</p>
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-3 pb-10 pt-6 sm:items-center sm:px-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-linea bg-tarjeta p-6 shadow-xl shadow-marca-700/5 sm:p-8">
          <h1 className="text-3xl font-bold">Sin conexión</h1>
          <Mensaje tono="alerta">No hay conexión a internet. Revisa el wifi o los datos del celular y vuelve a intentarlo.</Mensaje>
          <BotonReintentar />
        </div>
      </main>
    </div>
  );
}
