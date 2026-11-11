import { ControlTexto } from "@/components/layout/ControlTexto";

/**
 * Diseño de las pantallas públicas (inicio de sesión y registro).
 * Mismo encabezado vino que el menú de la app (Black Cherry + marca en champaña),
 * para que el paso del login al panel se sienta como una sola aplicación.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="zona-oscura border-b-2 border-champan bg-marca-800 shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <p className="font-titulo text-xl font-bold uppercase tracking-[0.12em] text-champan sm:text-2xl">Gestión de Perfumerías</p>
          <ControlTexto claro />
        </div>
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-3 pb-10 pt-6 sm:items-center sm:px-6">
        {children}
      </main>
    </div>
  );
}
