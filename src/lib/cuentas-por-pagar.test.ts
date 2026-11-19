/** Pruebas de las compras y cuentas por pagar a proveedores: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aplicarAbonoProveedor, estadoInicialCompra, textoMedioPagoCompra } from "./cuentas-por-pagar";

describe("estadoInicialCompra", () => {
  it("una compra a crédito nace pendiente con saldo igual al total", () => {
    assert.deepEqual(estadoInicialCompra("CREDITO", 500_000), { saldo: 500_000, estado: "PENDIENTE" });
  });
  it("una compra de contado nace saldada y sin saldo", () => {
    assert.deepEqual(estadoInicialCompra("EFECTIVO", 500_000), { saldo: 0, estado: "SALDADA" });
    assert.deepEqual(estadoInicialCompra("TRANSFERENCIA", 500_000), { saldo: 0, estado: "SALDADA" });
  });
});

describe("aplicarAbonoProveedor", () => {
  it("un abono parcial baja el saldo y sigue pendiente", () => {
    assert.deepEqual(aplicarAbonoProveedor(500_000, 200_000), { nuevoSaldo: 300_000, estado: "PENDIENTE" });
  });
  it("el abono que completa el saldo deja la compra saldada", () => {
    assert.deepEqual(aplicarAbonoProveedor(300_000, 300_000), { nuevoSaldo: 0, estado: "SALDADA" });
  });
  it("rechaza abonos mayores que el saldo", () => {
    assert.ok(aplicarAbonoProveedor(100_000, 150_000).error?.includes("saldo pendiente"));
  });
  it("rechaza abonos en cero, negativos o con decimales", () => {
    assert.ok(aplicarAbonoProveedor(100_000, 0).error);
    assert.ok(aplicarAbonoProveedor(100_000, -5).error);
    assert.ok(aplicarAbonoProveedor(100_000, 10.5).error);
  });
  it("rechaza abonar a una compra ya saldada", () => {
    assert.ok(aplicarAbonoProveedor(0, 1_000).error?.includes("saldada"));
  });
});

describe("textoMedioPagoCompra", () => {
  it("muestra el crédito como crédito con el proveedor", () => {
    assert.equal(textoMedioPagoCompra("CREDITO"), "Crédito con el proveedor");
    assert.equal(textoMedioPagoCompra("EFECTIVO"), "Efectivo");
  });
});
