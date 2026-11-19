/**
 * Caja del día: el dinero que entró y salió del local, separado en efectivo y transferencia.
 * Funciones puras (pruebas en caja.test.ts); el servidor arma la lista de movimientos (servicios/caja.ts).
 *
 *  Entradas: ventas de contado y abonos de clientes.
 *  Salidas:  gastos de contado (también los personales: ese dinero sí sale del cajón) y pagos de deudas.
 *  Informativo (NO se resta): pagos a proveedores por compras de mercancía. La mercancía también se anota
 *            como gasto (ver servicios/compras.ts); restarlos aquí contaría dos veces el mismo dinero.
 *  NO entran: ventas a crédito (el dinero llega con cada abono), gastos a crédito (sale con cada pago)
 *            ni nada anulado.
 *  Saldo:    entradas − salidas. El efectivo neto es lo que debería haber de más (o de menos) en el cajón.
 */

export type TipoMovimientoCaja = "VENTA" | "ABONO" | "GASTO" | "PAGO_DEUDA";

export const TEXTO_TIPO_MOVIMIENTO: Record<TipoMovimientoCaja, string> = {
  VENTA: "Venta de contado",
  ABONO: "Abono de cliente",
  GASTO: "Gasto de contado",
  PAGO_DEUDA: "Pago de deuda",
};

/** Los tipos que son entradas de dinero (el resto son salidas). */
export const TIPOS_ENTRADA: readonly TipoMovimientoCaja[] = ["VENTA", "ABONO"];

export interface MovimientoCaja {
  tipo: TipoMovimientoCaja;
  /** Día en Colombia, "AAAA-MM-DD". */
  dia: string;
  /** Fecha y hora (ISO) si se conoce; un gasto registrado otro día solo tiene su día. */
  hora: string | null;
  descripcion: string;
  efectivo: number;
  transferencia: number;
}

export interface TotalesMedio {
  efectivo: number;
  transferencia: number;
  total: number;
}

export interface ResumenCaja {
  entradas: TotalesMedio;
  salidas: TotalesMedio;
  saldo: TotalesMedio;
  /** Totales por tipo de movimiento (para el detalle de entradas y salidas). */
  porTipo: Record<TipoMovimientoCaja, TotalesMedio>;
}

const vacio = (): TotalesMedio => ({ efectivo: 0, transferencia: 0, total: 0 });

export const esEntrada = (tipo: TipoMovimientoCaja) => TIPOS_ENTRADA.includes(tipo);

/** Suma los movimientos en entradas, salidas y saldo (efectivo, transferencia y total). */
export function calcularCaja(movimientos: MovimientoCaja[]): ResumenCaja {
  const porTipo = { VENTA: vacio(), ABONO: vacio(), GASTO: vacio(), PAGO_DEUDA: vacio() };
  const entradas = vacio();
  const salidas = vacio();
  for (const m of movimientos) {
    const destino = esEntrada(m.tipo) ? entradas : salidas;
    for (const t of [destino, porTipo[m.tipo]]) {
      t.efectivo += m.efectivo;
      t.transferencia += m.transferencia;
      t.total += m.efectivo + m.transferencia;
    }
  }
  const saldo = {
    efectivo: entradas.efectivo - salidas.efectivo,
    transferencia: entradas.transferencia - salidas.transferencia,
    total: entradas.total - salidas.total,
  };
  return { entradas, salidas, saldo, porTipo };
}

export interface FilaCajaDiaria {
  dia: string;
  entradasEfectivo: number;
  entradasTransferencia: number;
  salidasEfectivo: number;
  salidasTransferencia: number;
  saldoEfectivo: number;
  saldoTransferencia: number;
  saldoTotal: number;
}

/** Un día por fila (solo los días con movimientos), del más antiguo al más reciente. Para el Excel «Caja diaria». */
export function cajaPorDia(movimientos: MovimientoCaja[]): FilaCajaDiaria[] {
  const dias = new Map<string, MovimientoCaja[]>();
  for (const m of movimientos) dias.set(m.dia, [...(dias.get(m.dia) ?? []), m]);
  return [...dias.keys()].sort().map((dia) => {
    const c = calcularCaja(dias.get(dia)!);
    return {
      dia,
      entradasEfectivo: c.entradas.efectivo,
      entradasTransferencia: c.entradas.transferencia,
      salidasEfectivo: c.salidas.efectivo,
      salidasTransferencia: c.salidas.transferencia,
      saldoEfectivo: c.saldo.efectivo,
      saldoTransferencia: c.saldo.transferencia,
      saldoTotal: c.saldo.total,
    };
  });
}

/** Ordena los movimientos para mostrarlos: por hora (los que solo tienen día van al final del día). */
export function ordenarMovimientos(movimientos: MovimientoCaja[]): MovimientoCaja[] {
  return [...movimientos].sort((a, b) => {
    if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
    if (a.hora && b.hora) return a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0;
    return a.hora ? -1 : b.hora ? 1 : 0;
  });
}
