/**
 * Compras de mercancía a proveedores y cuentas por pagar (crédito con el proveedor).
 *  - La compra se registra al «Agregar unidades», dentro de la MISMA transacción que suma el stock.
 *  - De contado queda saldada; a crédito queda pendiente con saldo = total.
 *  - Los abonos siguen la misma lógica que los abonos de clientes (creditos.ts): se bloquea la fila,
 *    no se puede abonar más que el saldo, el medio de pago se valida con resolverPago y,
 *    cuando el saldo llega a 0, la compra pasa a SALDADA.
 *  - Las compras y abonos NO cambian la utilidad: los gastos de mercancía se siguen registrando en Gastos.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type Transaccion } from "@/db";
import { abonosProveedor, comprasMercancia, proveedores } from "@/db/schema";
import { ApiError, type VendedorSesion } from "@/lib/api";
import { aplicarAbonoProveedor, estadoInicialCompra } from "@/lib/cuentas-por-pagar";
import { hoyColombia } from "@/lib/formato";
import type { MedioPagoCompra } from "@/tipos";
import type { Autor } from "./movimientos";
import { resolverPago, type DatosPago } from "./pagos";

export interface DatosCompra {
  proveedorId: string;
  total: number;
  medioPago: MedioPagoCompra;
}

/** Registra la compra (se llama dentro de la transacción del ingreso de stock). */
export async function registrarCompra(
  tx: Transaccion,
  datos: DatosCompra & { localId: string; producto: { id: string; nombre: string }; cantidad: number; autor: Autor; nota?: string },
) {
  const [proveedor] = await tx
    .select({ id: proveedores.id, nombre: proveedores.nombre, activo: proveedores.activo })
    .from(proveedores)
    .where(and(eq(proveedores.id, datos.proveedorId), eq(proveedores.localId, datos.localId)));
  if (!proveedor || !proveedor.activo) throw new ApiError(400, "El proveedor elegido no existe o está desactivado.");

  const { saldo, estado } = estadoInicialCompra(datos.medioPago, datos.total);
  await tx.insert(comprasMercancia).values({
    localId: datos.localId,
    proveedorId: proveedor.id,
    proveedorNombre: proveedor.nombre,
    productoId: datos.producto.id,
    productoNombre: datos.producto.nombre,
    cantidad: datos.cantidad,
    total: datos.total,
    medioPago: datos.medioPago,
    saldo,
    estado,
    usuarioId: datos.autor.id,
    usuarioNombre: datos.autor.nombre,
    nota: datos.nota || null,
    saldadaEn: estado === "SALDADA" ? new Date() : null,
  });
  return { proveedorNombre: proveedor.nombre, aCredito: datos.medioPago === "CREDITO" };
}

export interface DatosAbonoProveedor extends DatosPago {
  valor: number;
  fecha: string;
  nota?: string;
}

/** Abono a una compra a crédito. Devuelve el id del proveedor para recargar su ficha. */
export async function registrarAbonoProveedor(vendedor: VendedorSesion, compraId: string, datos: DatosAbonoProveedor) {
  if (datos.fecha > hoyColombia()) throw new ApiError(400, "La fecha del abono no puede ser futura.");
  // El medio de pago se valida sobre el valor del abono, igual que en los abonos de clientes
  const reparto = resolverPago(datos, datos.valor);

  return db.transaction(async (tx) => {
    // Bloquea la compra para evitar dos abonos simultáneos sobre el mismo saldo
    const [compra] = await tx
      .select()
      .from(comprasMercancia)
      .where(and(eq(comprasMercancia.id, compraId), eq(comprasMercancia.localId, vendedor.localId)))
      .for("update");
    if (!compra || compra.medioPago !== "CREDITO") throw new ApiError(404, "La compra a crédito no existe.");

    const resultado = aplicarAbonoProveedor(compra.saldo, datos.valor);
    if (resultado.error !== undefined) throw new ApiError(400, resultado.error);

    await tx.insert(abonosProveedor).values({
      compraId,
      valor: datos.valor,
      ...reparto,
      fecha: datos.fecha,
      usuarioId: vendedor.id,
      usuarioNombre: vendedor.nombre,
      nota: datos.nota || null,
    });
    await tx
      .update(comprasMercancia)
      .set({ saldo: resultado.nuevoSaldo, estado: resultado.estado, saldadaEn: resultado.estado === "SALDADA" ? new Date() : null })
      .where(eq(comprasMercancia.id, compraId));

    return { proveedorId: compra.proveedorId, saldo: resultado.nuevoSaldo, estado: resultado.estado };
  });
}
