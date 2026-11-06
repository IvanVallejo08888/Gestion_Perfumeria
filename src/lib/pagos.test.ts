/** Pruebas del reparto entre efectivo y transferencia. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularPago } from "./pagos";

describe("calcularPago", () => {
  it("efectivo y transferencia cubren todo el total", () => {
    assert.deepEqual(calcularPago("EFECTIVO", 100000), { valorEfectivo: 100000, valorTransferencia: 0, error: null });
    assert.deepEqual(calcularPago("TRANSFERENCIA", 100000), { valorEfectivo: 0, valorTransferencia: 100000, error: null });
  });
  it("en mixto el efectivo es lo que falta para el total", () => {
    assert.deepEqual(calcularPago("MIXTO", 100000, 30000), { valorEfectivo: 70000, valorTransferencia: 30000, error: null });
  });
  it("en mixto la transferencia debe ser mayor que 0 y menor que el total", () => {
    assert.ok(calcularPago("MIXTO", 100000, 0).error);
    assert.ok(calcularPago("MIXTO", 100000, 100000).error);
    assert.ok(calcularPago("MIXTO", 100000, 120000).error);
    assert.ok(calcularPago("MIXTO", 0, 0).error);
  });
});
