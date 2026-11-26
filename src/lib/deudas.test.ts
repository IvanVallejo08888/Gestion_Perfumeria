/** Pruebas de las deudas (reparto de cuotas, pagos, forma de pago final y recordatorios): npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarPagosACuotas,
  calcularResumenMedioPago,
  nivelRecordatorio,
  repartirEnCuotas,
  textoFormaPagoFinal,
  validarPagoDeuda,
  validarPlanCuotas,
} from "./deudas";

describe("repartirEnCuotas", () => {
  it("reparte en partes iguales cuando es exacto", () => {
    assert.deepEqual(repartirEnCuotas(900_000, 3), [300_000, 300_000, 300_000]);
  });
  it("la última cuota ajusta el redondeo", () => {
    assert.deepEqual(repartirEnCuotas(1_000_000, 3), [333_333, 333_333, 333_334]);
  });
  it("una sola cuota es el total", () => {
    assert.deepEqual(repartirEnCuotas(250_000, 1), [250_000]);
  });
  it("sin cuotas devuelve una lista vacía", () => {
    assert.deepEqual(repartirEnCuotas(100, 0), []);
  });
});

describe("validarPlanCuotas", () => {
  it("acepta cuotas que suman el total", () => {
    assert.equal(validarPlanCuotas(900_000, [400_000, 300_000, 200_000]), null);
  });
  it("avisa cuánto falta", () => {
    assert.match(validarPlanCuotas(900_000, [300_000, 300_000])!, /faltan \$ 300\.000/);
  });
  it("avisa cuánto sobra", () => {
    assert.match(validarPlanCuotas(900_000, [500_000, 500_000])!, /sobran \$ 100\.000/);
  });
  it("rechaza cuotas en cero o sin cuotas", () => {
    assert.ok(validarPlanCuotas(100, [100, 0]));
    assert.ok(validarPlanCuotas(100, []));
  });
});

describe("aplicarPagosACuotas", () => {
  const cuotas = [
    { id: "c3", numero: 3, valor: 300_000 },
    { id: "c1", numero: 1, valor: 300_000 },
    { id: "c2", numero: 2, valor: 300_000 },
  ];
  const dia = (d: number) => new Date(`2026-11-${String(d).padStart(2, "0")}T15:00:00-05:00`);

  it("aplica a las cuotas en orden de número", () => {
    const r = aplicarPagosACuotas(cuotas, [{ valor: 300_000, fecha: dia(5) }]);
    assert.deepEqual(
      r.map((c) => [c.numero, c.valorPagado, c.estado]),
      [
        [1, 300_000, "PAGADA"],
        [2, 0, "PENDIENTE"],
        [3, 0, "PENDIENTE"],
      ],
    );
    assert.deepEqual(r[0].pagadaEn, dia(5));
  });

  it("un pago parcial deja la cuota pendiente y el siguiente la completa", () => {
    const r = aplicarPagosACuotas(cuotas, [
      { valor: 450_000, fecha: dia(5) },
      { valor: 150_000, fecha: dia(9) },
    ]);
    assert.deepEqual(r.map((c) => c.valorPagado), [300_000, 300_000, 0]);
    assert.deepEqual(r[1].pagadaEn, dia(9));
  });

  it("los pagos se aplican en orden de fecha aunque lleguen desordenados", () => {
    const r = aplicarPagosACuotas(cuotas, [
      { valor: 100_000, fecha: dia(20) },
      { valor: 300_000, fecha: dia(1) },
    ]);
    assert.deepEqual(r[0].pagadaEn, dia(1));
    assert.equal(r[1].valorPagado, 100_000);
  });

  it("sin pagos (por ejemplo, al anular el único pago) todo vuelve a pendiente", () => {
    const r = aplicarPagosACuotas(cuotas, []);
    assert.ok(r.every((c) => c.valorPagado === 0 && c.estado === "PENDIENTE" && c.pagadaEn === null));
  });

  it("pagar todo de una vez deja todas las cuotas pagadas (pago anticipado)", () => {
    const r = aplicarPagosACuotas(cuotas, [{ valor: 900_000, fecha: dia(2) }]);
    assert.ok(r.every((c) => c.estado === "PAGADA"));
  });
});

describe("validarPagoDeuda", () => {
  it("rechaza un pago mayor que el saldo", () => {
    assert.match(validarPagoDeuda(300_000, 300_001)!, /no puede ser mayor que el saldo/);
  });
  it("rechaza cero, negativos y deudas ya pagadas", () => {
    assert.ok(validarPagoDeuda(300_000, 0));
    assert.ok(validarPagoDeuda(300_000, -5));
    assert.ok(validarPagoDeuda(0, 100));
  });
  it("acepta pagar exactamente el saldo", () => {
    assert.equal(validarPagoDeuda(300_000, 300_000), null);
  });
});

describe("calcularResumenMedioPago", () => {
  it("todo en efectivo → Gastos en efectivo", () => {
    const r = calcularResumenMedioPago([
      { valorEfectivo: 100, valorTransferencia: 0 },
      { valorEfectivo: 200, valorTransferencia: 0 },
    ])!;
    assert.deepEqual(r, { medio: "EFECTIVO", totalEfectivo: 300, totalTransferencia: 0 });
    assert.equal(textoFormaPagoFinal(r.medio), "Gastos en efectivo");
  });
  it("todo por transferencia → Gastos por transferencia", () => {
    const r = calcularResumenMedioPago([{ valorEfectivo: 0, valorTransferencia: 500 }])!;
    assert.equal(textoFormaPagoFinal(r.medio), "Gastos por transferencia");
  });
  it("efectivo + mixto + transferencia → Mixto con los dos totales", () => {
    // El caso del ejemplo: 300.000 efectivo, mixto (200.000 + 100.000) y 300.000 transferencia
    const r = calcularResumenMedioPago([
      { valorEfectivo: 300_000, valorTransferencia: 0 },
      { valorEfectivo: 200_000, valorTransferencia: 100_000 },
      { valorEfectivo: 0, valorTransferencia: 300_000 },
    ]);
    assert.deepEqual(r, { medio: "MIXTO", totalEfectivo: 500_000, totalTransferencia: 400_000 });
  });
  it("sin pagos no hay resumen", () => {
    assert.equal(calcularResumenMedioPago([]), null);
  });
});

describe("nivelRecordatorio", () => {
  const ahora = new Date("2026-11-19T10:00:00-05:00");
  it("hoy más tarde es HOY", () => {
    assert.equal(nivelRecordatorio(new Date("2026-11-19T18:00:00-05:00"), ahora), "HOY");
  });
  it("hoy más temprano o un día pasado es VENCIDA", () => {
    assert.equal(nivelRecordatorio(new Date("2026-11-19T08:00:00-05:00"), ahora), "VENCIDA");
    assert.equal(nivelRecordatorio(new Date("2026-11-18T23:00:00-05:00"), ahora), "VENCIDA");
  });
  it("un día futuro es PROXIMA (aunque en UTC ya sea el día siguiente)", () => {
    assert.equal(nivelRecordatorio(new Date("2026-11-20T20:00:00-05:00"), ahora), "PROXIMA");
    // 19 nov 21:00 en Colombia = 20 nov 02:00 UTC: sigue siendo HOY en Colombia
    assert.equal(nivelRecordatorio(new Date("2026-11-19T21:00:00-05:00"), ahora), "HOY");
  });
});
