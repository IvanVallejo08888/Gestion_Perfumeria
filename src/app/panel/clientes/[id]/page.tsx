import { BotonVolver } from "./BotonVolver";
import { DetalleCliente } from "@/components/clientes/DetalleCliente";

export const metadata = { title: "Detalle del cliente" };

/**
 * Detalle de un cliente como página completa (se usa en celular).
 * La seguridad la aplica la API: un cliente de otro local responde "El cliente no existe".
 */
export default async function PaginaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <BotonVolver />
      <DetalleCliente clienteId={id} />
    </>
  );
}
