/**
 * Trazabilidad del inventario: cada cambio de stock queda registrado.
 *  - INGRESO: llegó mercancía (o stock inicial al crear el producto).
 *  - VENTA:   lo registra la factura, dentro de su misma transacción.
 *  - AJUSTE:  corrección manual con motivo obligatorio.
 */
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, type Transaccion } from "@/db";
import { movimientosInventario, productos } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { TipoMovimiento } from "@/lib/inventario";
import type { MovimientoInventario } from "@/tipos";

/** Quién hizo el movimiento: se copia el nombre para que el historial no cambie. */
export interface Autor {
  id: string;
  nombre: string;
}

export interface NuevoMovimiento {
  localId: string;
  productoId: string;
  tipo: TipoMovimiento;
  /** Con signo: positivo entra, negativo sale. */
  cantidad: number;
  stockResultante: number;
  autor: Autor;
  facturaId?: string | null;
  nota?: string | null;
}

/** Siempre dentro de la transacción que cambia el stock: o se guardan los dos, o ninguno. */
export async function registrarMovimientos(tx: Transaccion, movimientos: NuevoMovimiento[]) {
  if (!movimientos.length) return;
  await tx.insert(movimientosInventario).values(
    movimientos.map((m) => ({
      localId: m.localId,
      productoId: m.productoId,
      tipo: m.tipo,
      cantidad: m.cantidad,
      stockResultante: m.stockResultante,
      usuarioId: m.autor.id,
      usuarioNombre: m.autor.nombre,
      facturaId: m.facturaId ?? null,
      nota: m.nota?.trim() || null,
    })),
  );
}

/** Máximo de movimientos que se muestran en el detalle del perfume. */
const LIMITE_MOVIMIENTOS = 20;

export async function listarMovimientos(localId: string, productoId: string): Promise<MovimientoInventario[]> {
  const producto = await db.query.productos.findFirst({
    columns: { id: true },
    where: and(eq(productos.id, productoId), eq(productos.localId, localId)),
  });
  if (!producto) throw new ApiError(404, "El producto no existe en tu local.");

  const filas = await db.query.movimientosInventario.findMany({
    where: and(eq(movimientosInventario.productoId, productoId), eq(movimientosInventario.localId, localId)),
    orderBy: [desc(movimientosInventario.creadoEn)],
    limit: LIMITE_MOVIMIENTOS,
    with: { factura: { columns: { numero: true } } },
  });
  return filas.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    stockResultante: m.stockResultante,
    usuarioNombre: m.usuarioNombre,
    facturaNumero: m.factura?.numero ?? null,
    nota: m.nota,
    creadoEn: m.creadoEn.toISOString(),
  }));
}
