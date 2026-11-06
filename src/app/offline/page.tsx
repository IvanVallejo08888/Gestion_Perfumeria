import type { Metadata } from "next";
import { Mensaje } from "@/components/ui/Basicos";
import { BotonReintentar } from "./BotonReintentar";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };

// Página fija y sin datos de nadie: es la única que guarda el service worker
export const dynamic = "force-static";

export default function PaginaSinConexion() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-marca-800 to-marca-900">
      <header className="px-4 py-4 sm:px-8">
        <p className="text-xl font-bold text-white sm:text-2xl">Gestión de Perfumerías</p>
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-3 pb-10 pt-4 sm:items-center sm:px-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-3xl font-bold">Sin conexión</h1>
          <Mensaje tono="alerta">No hay conexión a internet. Revisa tu conexión y vuelve a intentarlo</Mensaje>
          <BotonReintentar />
        </div>
      </main>
    </div>
  );
}
