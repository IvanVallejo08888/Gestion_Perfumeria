/** Pruebas de los totales de gastos y la utilidad: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularUtilidad, totalesGastos } from "./gastos";

describe("totalesGastos", () => {
  it("separa los gastos personales de los del negocio", () => {
    const totales = totalesGastos([
      { valor: 100_000, personal: false, medioPago: "EFECTIVO" },
      { valor: 50_000, personal: false, medioPago: "TRANSFERENCIA" },
      { valor: 30_000, personal: true, medioPago: "EFECTIVO" },
      { valor: 20_000, personal: true, medioPago: "TRANSFERENCIA" },
    ]);
    assert.deepEqual(totales, { total: 150_000, totalEfectivo: 100_000, totalTransferencia: 50_000, totalPersonales: 50_000 });
  });

  it("sin gastos todo queda en cero", () => {
    assert.deepEqual(totalesGastos([]), { total: 0, totalEfectivo: 0, totalTransferencia: 0, totalPersonales: 0 });
  });
});

describe("calcularUtilidad", () => {
  it("resta solo los gastos del negocio", () => {
    const { total } = totalesGastos([
      { valor: 200_000, personal: false, medioPago: "EFECTIVO" },
      { valor: 500_000, personal: true, medioPago: "EFECTIVO" },
    ]);
    assert.equal(calcularUtilidad(1_000_000, total), 800_000);
  });

  it("puede dar pérdida si los gastos del negocio superan lo recibido", () => {
    assert.equal(calcularUtilidad(100_000, 150_000), -50_000);
  });
});
