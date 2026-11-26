/** Pruebas del valor de las cuotas. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ajustarCantidadValores, repartirEnPartesIguales, resumirCuotas, revisarValoresCuotas } from "./cuotas";

describe("repartirEnPartesIguales", () => {
  it("reparte exacto cuando se puede", () => {
    assert.deepEqual(repartirEnPartesIguales(300_000, 3), [100_000, 100_000, 100_000]);
  });
  it("la última cuota absorbe el redondeo y la suma da el total", () => {
    const v = repartirEnPartesIguales(100_000, 3);
    assert.deepEqual(v, [33_333, 33_333, 33_334]);
    assert.equal(v.reduce((s, x) => s + x, 0), 100_000);
  });
  it("sin cuotas devuelve lista vacía", () => {
    assert.deepEqual(repartirEnPartesIguales(100_000, 0), []);
  });
});

describe("ajustarCantidadValores", () => {
  it("conserva lo escrito y agrega cuotas en 0", () => {
    assert.deepEqual(ajustarCantidadValores([50_000, 20_000], 4), [50_000, 20_000, 0, 0]);
  });
  it("recorta si hay menos cuotas", () => {
    assert.deepEqual(ajustarCantidadValores([50_000, 20_000, 10_000], 2), [50_000, 20_000]);
  });
});

describe("resumirCuotas", () => {
  it("calcula asignado, diferencia y cuotas sin valor", () => {
    assert.deepEqual(resumirCuotas([60_000, 0, 20_000], 100_000), { asignado: 80_000, diferencia: 20_000, sinValor: [2] });
  });
});

describe("revisarValoresCuotas", () => {
  it("acepta valores que suman el total", () => {
    assert.equal(revisarValoresCuotas([50_000, 30_000, 20_000], 100_000), null);
  });
  it("pide las cuotas sin valor", () => {
    assert.match(revisarValoresCuotas([100_000, 0], 100_000) ?? "", /cuota 2/);
    assert.match(revisarValoresCuotas([0, 0, 100_000], 100_000) ?? "", /cuotas 1, 2/);
  });
  it("avisa cuando falta o sobra dinero", () => {
    assert.match(revisarValoresCuotas([40_000, 40_000], 100_000) ?? "", /faltan/);
    assert.match(revisarValoresCuotas([60_000, 60_000], 100_000) ?? "", /sobran/);
  });
  it("rechaza listas vacías, negativos y decimales", () => {
    assert.ok(revisarValoresCuotas([], 100_000));
    assert.ok(revisarValoresCuotas([-10, 100_010], 100_000));
    assert.ok(revisarValoresCuotas([50_000.5, 49_999.5], 100_000));
  });
});
