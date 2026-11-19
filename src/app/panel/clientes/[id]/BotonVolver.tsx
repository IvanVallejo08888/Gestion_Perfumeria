/** "← Volver a clientes": regresa a la misma página y búsqueda de la lista (como el botón Atrás). */
"use client";

import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/Boton";

export function BotonVolver() {
  const router = useRouter();
  return (
    <div className="mb-4">
      <Boton
        variante="secundario"
        onClick={() => {
          // Si se llegó desde la lista, volver conserva la página; si se abrió el enlace directo, va a la lista
          if (window.history.length > 1) router.back();
          else router.push("/panel/clientes");
        }}
      >
        ← Volver a clientes
      </Boton>
    </div>
  );
}
