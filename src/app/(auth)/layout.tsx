import { ControlTexto } from "@/components/layout/ControlTexto";

/** Diseño de las pantallas públicas (inicio de sesión y registro). */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-marca-800 to-marca-900">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <p className="text-xl font-bold text-white sm:text-2xl">Gestión de Perfumerías</p>
        <ControlTexto claro />
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-3 pb-10 pt-4 sm:items-center sm:px-6">
        {children}
      </main>
    </div>
  );
}
