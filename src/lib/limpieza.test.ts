/** Pruebas de las reglas de la limpieza del sistema. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmacionCoincide,
  describirConteos,
  describirPeriodo,
  hayAlgoQueBorrar,
  mesesFuturos,
  normalizarMeses,
  rangosDelPeriodo,
  textoConfirmacion,
  type ConteosLimpieza,
} from "./limpieza";

// "Hoy" fijo para las pruebas: 19 de noviembre de 2026, 10 a. m. en Colombia
const HOY = new Date("2026-11-19T10:00:00-05:00");

describe("mesesFuturos", () => {
  it("permite meses terminados y el mes actual", () => {
    assert.deepEqual(mesesFuturos(2026, [3, 4, 11], HOY), []);
    assert.deepEqual(mesesFuturos(2025, [12], HOY), []);
    assert.deepEqual(mesesFuturos(2026, [], HOY), []);
  });
  it("rechaza meses futuros y años futuros", () => {
    assert.deepEqual(mesesFuturos(2026, [11, 12], HOY), [12]);
    assert.deepEqual(mesesFuturos(2027, [1], HOY), [1]);
    assert.notDeepEqual(mesesFuturos(2027, [], HOY), []);
  });
  it("usa la hora de Colombia: el 1 de diciembre a las 2 a. m. UTC todavía es noviembre", () => {
    assert.deepEqual(mesesFuturos(2026, [12], new Date("2026-12-01T02:00:00Z")), [12]);
  });
});

describe("rangosDelPeriodo", () => {
  it("un rango por mes, en hora de Colombia (UTC-5)", () => {
    const { instantes, dias } = rangosDelPeriodo(2026, [4, 3]);
    assert.equal(instantes.length, 2);
    assert.equal(instantes[0].inicio.toISOString(), "2026-03-01T05:00:00.000Z");
    assert.equal(instantes[0].fin.toISOString(), "2026-04-01T05:00:00.000Z");
    assert.equal(instantes[1].fin.toISOString(), "2026-05-01T05:00:00.000Z");
    assert.deepEqual(dias, [
      { desde: "2026-03-01", hasta: "2026-04-01" },
      { desde: "2026-04-01", hasta: "2026-05-01" },
    ]);
  });
  it("meses no seguidos: marzo y mayo (abril no se toca)", () => {
    const { dias } = rangosDelPeriodo(2026, [3, 5]);
    assert.deepEqual(dias.map((d) => d.desde), ["2026-03-01", "2026-05-01"]);
  });
  it("sin meses = todo el año; diciembre termina el 1 de enero siguiente", () => {
    assert.deepEqual(rangosDelPeriodo(2026, []).dias, [{ desde: "2026-01-01", hasta: "2027-01-01" }]);
    assert.equal(rangosDelPeriodo(2026, [12]).instantes[0].fin.toISOString(), "2027-01-01T05:00:00.000Z");
  });
});

describe("normalizarMeses y describirPeriodo", () => {
  it("quita repetidos, valores raros y ordena", () => {
    assert.deepEqual(normalizarMeses([4, 3, 4, 0, 13, 2.5]), [3, 4]);
  });
  it("describe el periodo en español", () => {
    assert.equal(describirPeriodo(2026, [3, 4]), "Marzo y Abril de 2026");
    assert.equal(describirPeriodo(2026, [1, 3, 5]), "Enero, Marzo y Mayo de 2026");
    assert.equal(describirPeriodo(2026, []), "Todo el año 2026");
  });
});

describe("confirmacionCoincide", () => {
  it("ignora mayúsculas y espacios de más", () => {
    assert.equal(textoConfirmacion("Local Centro"), "BORRAR Local Centro");
    assert.ok(confirmacionCoincide("borrar local centro", "Local Centro"));
    assert.ok(confirmacionCoincide("  BORRAR   Local    Centro ", "Local Centro"));
    assert.ok(confirmacionCoincide("borrar local ñandú", "Local Ñandú"));
  });
  it("rechaza otro local o el texto incompleto", () => {
    assert.ok(!confirmacionCoincide("BORRAR Local Norte", "Local Centro"));
    assert.ok(!confirmacionCoincide("Local Centro", "Local Centro"));
    assert.ok(!confirmacionCoincide("BORRAR", "Local Centro"));
  });
});

describe("conteos", () => {
  const vacio: ConteosLimpieza = {
    ventas: { cantidad: 0, valor: 0, anuladas: 0 },
    itemsVenta: 0,
    creditos: { cantidad: 0, valor: 0, conSaldo: 0, saldo: 0 },
    cuotas: 0,
    abonos: { cantidad: 0, valor: 0 },
    gastos: { cantidad: 0, valor: 0, eliminados: 0 },
    clientes: { cantidad: 0, conservados: 3 },
    productos: { cantidad: 0, movimientos: 0 },
    conservados: { creditos: 2, abonos: 1 },
  };
  it("un periodo sin datos no tiene nada que borrar (aunque haya cosas conservadas)", () => {
    assert.equal(hayAlgoQueBorrar(vacio), false);
    assert.equal(describirConteos(vacio), "nada");
  });
  it("describe solo lo que se borra", () => {
    const c = { ...vacio, ventas: { cantidad: 3, valor: 1, anuladas: 0 }, gastos: { cantidad: 1, valor: 5, eliminados: 0 } };
    assert.equal(hayAlgoQueBorrar(c), true);
    assert.equal(describirConteos(c), "3 ventas y 1 gasto");
  });
});
