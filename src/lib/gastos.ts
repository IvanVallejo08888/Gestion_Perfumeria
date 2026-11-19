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
  medioPago: "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";
}

/** Pago de una deuda (dinero que SÍ salió de la caja), con la categoría personal de su gasto de origen. */
interface PagoDeudaBase {
  valorEfectivo: number;
  valorTransferencia: number;
  personal: boolean;
}

export interface TotalesGastosCalculados {
  /** Gastos del negocio (los que se restan de la utilidad) = contado + pagos de deudas. */
  total: number;
  totalEfectivo: number;
  totalTransferencia: number;
  /** Gastos personales (no se restan de la utilidad), también los pagos de deudas personales. */
  totalPersonales: number;
  /** Parte de "total" que son pagos de deudas del negocio. */
  totalPagosDeudas: number;
}

/**
 * Suma los gastos de un periodo con la regla contable de las deudas:
 *  - los gastos a CRÉDITO no suman (ese día no sale dinero: solo nace la deuda);
 *  - los pagos de deudas del periodo SÍ suman, con su efectivo y su transferencia;
 *  - lo personal (de la dueña) va aparte.
 */
export function totalesGastos(lista: GastoBase[], pagosDeudas: PagoDeudaBase[] = []): TotalesGastosCalculados {
  const totales: TotalesGastosCalculados = { total: 0, totalEfectivo: 0, totalTransferencia: 0, totalPersonales: 0, totalPagosDeudas: 0 };
  for (const g of lista) {
    if (g.medioPago === "CREDITO") continue;
    if (g.personal) {
      totales.totalPersonales += g.valor;
      continue;
    }
    totales.total += g.valor;
    if (g.medioPago === "EFECTIVO") totales.totalEfectivo += g.valor;
    else totales.totalTransferencia += g.valor;
  }
  for (const p of pagosDeudas) {
    const valor = p.valorEfectivo + p.valorTransferencia;
    if (p.personal) {
      totales.totalPersonales += valor;
      continue;
    }
    totales.total += valor;
    totales.totalPagosDeudas += valor;
    totales.totalEfectivo += p.valorEfectivo;
    totales.totalTransferencia += p.valorTransferencia;
  }
  return totales;
}

/** Utilidad = dinero recibido − gastos del negocio. Los gastos personales no entran. */
export function calcularUtilidad(recibido: number, gastosNegocio: number): number {
  return recibido - gastosNegocio;
}
