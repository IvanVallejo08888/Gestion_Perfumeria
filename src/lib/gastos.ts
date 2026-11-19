/**
 * Reglas de los gastos compartidas por el servidor y la pantalla.
 * Los «Gastos personales» (gastos propios de la dueña) se registran como cualquier gasto,
 * pero se muestran aparte y NO se restan de la utilidad del negocio.
 */

/** Nombre de la categoría de gastos personales que tiene cada local. */
export const NOMBRE_CATEGORIA_PERSONAL = "Gastos personales";

interface GastoBase {
  valor: number;
  personal: boolean;
  medioPago: "EFECTIVO" | "TRANSFERENCIA";
}

export interface TotalesGastosCalculados {
  /** Gastos del negocio (los que se restan de la utilidad). */
  total: number;
  totalEfectivo: number;
  totalTransferencia: number;
  /** Gastos personales (no se restan de la utilidad). */
  totalPersonales: number;
}

/** Suma los gastos separando los del negocio de los personales. */
export function totalesGastos(lista: GastoBase[]): TotalesGastosCalculados {
  const totales: TotalesGastosCalculados = { total: 0, totalEfectivo: 0, totalTransferencia: 0, totalPersonales: 0 };
  for (const g of lista) {
    if (g.personal) {
      totales.totalPersonales += g.valor;
      continue;
    }
    totales.total += g.valor;
    if (g.medioPago === "EFECTIVO") totales.totalEfectivo += g.valor;
    else totales.totalTransferencia += g.valor;
  }
  return totales;
}

/** Utilidad = dinero recibido − gastos del negocio. Los gastos personales no entran. */
export function calcularUtilidad(recibido: number, gastosNegocio: number): number {
  return recibido - gastosNegocio;
}
