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
    assert.deepEqual(totales, { total: 150_000, totalEfectivo: 100_000, totalTransferencia: 50_000, totalPersonales: 50_000, totalPagosDeudas: 0 });
  });

  it("sin gastos todo queda en cero", () => {
    assert.deepEqual(totalesGastos([]), { total: 0, totalEfectivo: 0, totalTransferencia: 0, totalPersonales: 0, totalPagosDeudas: 0 });
  });
});

describe("totalesGastos con deudas (regla contable)", () => {
  it("un gasto a crédito NO suma; cada pago de la deuda SÍ suma, con su medio", () => {
    const totales = totalesGastos(
      [
        { valor: 50_000, personal: false, medioPago: "EFECTIVO" },
        // Deuda de $ 900.000 registrada este mes: no es dinero que haya salido
        { valor: 900_000, personal: false, medioPago: "CREDITO" },
      ],
      [
        { valorEfectivo: 300_000, valorTransferencia: 0, personal: false },
        { valorEfectivo: 200_000, valorTransferencia: 100_000, personal: false },
      ],
    );
    assert.deepEqual(totales, {
      total: 650_000,
      totalEfectivo: 550_000,
      totalTransferencia: 100_000,
      totalPersonales: 0,
      totalPagosDeudas: 600_000,
    });
  });

  it("la deuda completa nunca se cuenta dos veces: registrarla + pagarla = solo los pagos", () => {
    const registrar = totalesGastos([{ valor: 900_000, personal: false, medioPago: "CREDITO" }]);
    assert.equal(registrar.total, 0);
    const pagos = [1, 2, 3].map(() => ({ valorEfectivo: 300_000, valorTransferencia: 0, personal: false }));
    assert.equal(totalesGastos([{ valor: 900_000, personal: false, medioPago: "CREDITO" }], pagos).total, 900_000);
  });

  it("los pagos de una deuda personal van a gastos personales", () => {
    const totales = totalesGastos([], [{ valorEfectivo: 80_000, valorTransferencia: 0, personal: true }]);
    assert.equal(totales.total, 0);
    assert.equal(totales.totalPersonales, 80_000);
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
