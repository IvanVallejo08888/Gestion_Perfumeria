/**
 * Servicio de clientes. Cada local tiene su propia lista de clientes.
 * Se usa para autocompletar los datos al escribir la identificación en la factura.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes } from "@/db/schema";

export async function buscarClientePorIdentificacion(localId: string, identificacion: string) {
  const cliente = await db.query.clientes.findFirst({
    where: and(eq(clientes.localId, localId), eq(clientes.identificacion, identificacion.trim())),
    columns: { identificacion: true, nombre: true, telefono: true, direccion: true, sector: true },
  });
  return cliente ?? null;
}
