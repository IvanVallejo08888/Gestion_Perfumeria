/** Pruebas de la caja del día: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cajaPorDia, calcularCaja, ordenarMovimientos, type MovimientoCaja } from "./caja";

const mov = (m: Partial<MovimientoCaja> & Pick<MovimientoCaja, "tipo">): MovimientoCaja => ({
  dia: "2026-11-19",
  hora: null,
  descripcion: "",
  efectivo: 0,
  transferencia: 0,
  ...m,
});

describe("calcularCaja", () => {
  it("separa entradas y salidas por medio y calcula el saldo", () => {
    const c = calcularCaja([
      mov({ tipo: "VENTA", efectivo: 500_000, transferencia: 200_000 }),
      mov({ tipo: "ABONO", transferencia: 100_000 }),
      mov({ tipo: "GASTO", efectivo: 50_000 }),
      // Pago mixto de una deuda: 200.000 en efectivo y 100.000 por transferencia
      mov({ tipo: "PAGO_DEUDA", efectivo: 200_000, transferencia: 100_000 }),
    ]);
    assert.deepEqual(c.entradas, { efectivo: 500_000, transferencia: 300_000, total: 800_000 });
    assert.deepEqual(c.salidas, { efectivo: 250_000, transferencia: 100_000, total: 350_000 });
    assert.deepEqual(c.saldo, { efectivo: 250_000, transferencia: 200_000, total: 450_000 });
    assert.deepEqual(c.porTipo.PAGO_DEUDA, { efectivo: 200_000, transferencia: 100_000, total: 300_000 });
  });

  it("el saldo puede quedar negativo (salió más de lo que entró)", () => {
    const c = calcularCaja([mov({ tipo: "PAGO_DEUDA", efectivo: 300_000 })]);
    assert.equal(c.saldo.efectivo, -300_000);
  });

  it("un día sin movimientos da todo en cero", () => {
    const c = calcularCaja([]);
    assert.deepEqual(c.saldo, { efectivo: 0, transferencia: 0, total: 0 });
    assert.deepEqual(c.porTipo.VENTA, { efectivo: 0, transferencia: 0, total: 0 });
  });
});

describe("cajaPorDia", () => {
  it("un día por fila, en orden, solo los días con movimientos", () => {
    const filas = cajaPorDia([
      mov({ tipo: "VENTA", dia: "2026-11-20", efectivo: 100 }),
      mov({ tipo: "GASTO", dia: "2026-11-18", efectivo: 30 }),
      mov({ tipo: "VENTA", dia: "2026-11-18", transferencia: 70 }),
    ]);
    assert.deepEqual(
      filas.map((f) => [f.dia, f.saldoEfectivo, f.saldoTransferencia, f.saldoTotal]),
      [
        ["2026-11-18", -30, 70, 40],
        ["2026-11-20", 100, 0, 100],
      ],
    );
  });
  it("sin movimientos no hay filas", () => {
    assert.deepEqual(cajaPorDia([]), []);
  });
});

describe("ordenarMovimientos", () => {
  it("ordena por hora y deja al final los que solo tienen día", () => {
    const lista = ordenarMovimientos([
      mov({ tipo: "GASTO", descripcion: "sin hora" }),
      mov({ tipo: "VENTA", descripcion: "tarde", hora: "2026-11-19T20:00:00.000Z" }),
      mov({ tipo: "VENTA", descripcion: "mañana", hora: "2026-11-19T14:00:00.000Z" }),
    ]);
    assert.deepEqual(lista.map((m) => m.descripcion), ["mañana", "tarde", "sin hora"]);
  });
});
