/**
 * Confirmación de "Eliminar venta" (se usa en el Historial, en Créditos y en el récord del cliente).
 *
 * Muestra con claridad qué va a pasar antes de anular:
 *  - cliente, número de factura y total;
 *  - los productos que volverán al inventario;
 *  - si es un crédito con abonos, un aviso destacado de que esos abonos también se anulan;
 *  - un campo obligatorio "Motivo de la eliminación".
 * Al terminar avisa, actualiza el contador de notificaciones y llama a onAnulada().
 */
"use client";

import { useState } from "react";
import { useConsulta } from "@/hooks/useConsulta";
import { avisarCambioNotificaciones } from "@/hooks/useNotificaciones";
import { numeroFactura, pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import { motivoAnulacionSchema } from "@/lib/validaciones";
import type { FacturaDetalle, ResultadoAnulacion } from "@/tipos";
import { useAvisos } from "../ui/Avisos";
import { Cargando, Mensaje } from "../ui/Basicos";
import { Campo } from "../ui/Campo";
import { Confirmar } from "../ui/Modal";

export function ConfirmarAnulacion({
  facturaId,
  onCerrar,
  onAnulada,
}: {
  /** Factura a eliminar; null = ventana cerrada. */
  facturaId: string | null;
  onCerrar: () => void;
  onAnulada: () => void;
}) {
  const avisos = useAvisos();
  const url = facturaId ? `/api/facturas/${facturaId}` : null;
  const consulta = useConsulta<{ factura: FacturaDetalle }>(url);
  // Mientras carga otra factura no se muestra la anterior
  const factura = consulta.urlDatos === url ? (consulta.datos?.factura ?? null) : null;

  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const totalAbonos = factura?.abonos.reduce((acc, a) => acc + a.valor, 0) ?? 0;

  function cerrar() {
    if (enviando) return;
    setMotivo("");
    setErrorMotivo("");
    onCerrar();
  }

  async function confirmar() {
    if (!factura) return;
    const validacion = motivoAnulacionSchema.safeParse({ motivo });
    if (!validacion.success) return setErrorMotivo(validacion.error.issues[0].message);
    setErrorMotivo("");
    setEnviando(true);
    try {
      const { resultado } = await api<{ resultado: ResultadoAnulacion }>(`/api/facturas/${factura.id}/anular`, {
        method: "POST",
        json: validacion.data,
      });
      avisos.exito("Venta eliminada. Los productos regresaron al inventario.");
      // Productos que ya no existen en el inventario: se avisa para que el vendedor lo sepa
      if (resultado.omitidos.length) {
        avisos.info(
          `No se devolvieron al inventario porque ya no existen: ${resultado.omitidos.map((o) => `${o.nombre} (${o.cantidad})`).join(", ")}.`,
        );
      }
      avisarCambioNotificaciones();
      setMotivo("");
      onAnulada();
    } catch (e) {
      avisos.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Confirmar
      abierto={facturaId !== null}
      titulo="Eliminar venta"
      textoConfirmar="Sí, eliminar venta"
      peligro
      cargando={enviando || !factura}
      onConfirmar={confirmar}
      onCerrar={cerrar}
      mensaje={
        consulta.error ? (
          <Mensaje tono="peligro">{consulta.error}</Mensaje>
        ) : !factura ? (
          <Cargando />
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-1 rounded-xl bg-gray-50 p-4">
              <div>
                <dt className="inline font-bold">Cliente: </dt>
                <dd className="inline">{factura.clienteNombre}</dd>
              </div>
              <div>
                <dt className="inline font-bold">Factura N°: </dt>
                <dd className="inline">{numeroFactura(factura.numero)}</dd>
              </div>
              <div>
                <dt className="inline font-bold">Total: </dt>
                <dd className="inline">{pesos(factura.total)}</dd>
              </div>
            </dl>

            <div>
              <p className="font-bold">Estos productos volverán al inventario:</p>
              <ul className="mt-1 list-disc space-y-1 pl-6">
                {factura.items.map((i) => (
                  <li key={i.id}>
                    {i.nombreProducto} — {i.cantidad} {i.cantidad === 1 ? "unidad" : "unidades"}
                  </li>
                ))}
              </ul>
            </div>

            {totalAbonos > 0 && (
              <Mensaje tono="alerta" titulo={`Este crédito tiene abonos por ${pesos(totalAbonos)}.`}>
                Al eliminarlo, esos abonos también quedarán anulados.
              </Mensaje>
            )}

            <Campo
              etiqueta="Motivo de la eliminación"
              obligatorio
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              error={errorMotivo}
              ayuda="Entre 5 y 200 caracteres. Ejemplo: El cliente devolvió los productos."
            />
          </div>
        )
      }
    />
  );
}
