/** Pruebas de las reglas del dashboard (cortes de ventas). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completarCortes, CORTES_PUBLICO, CORTES_TIPO, hayDatos, ordenarCortes, pesosCorto, topConOtras } from "./dashboard";

describe("cortes de lista fija", () => {
  it("el público sale siempre como Hombre, Niño, Mujer, Niña", () => {
    assert.deepEqual(
      CORTES_PUBLICO.map((c) => c.etiqueta),
      ["Hombre", "Niño", "Mujer", "Niña"],
    );
  });
  it("completa con cero y conserva el orden", () => {
    const cortes = completarCortes(CORTES_TIPO, [{ clave: "ESENCIA", unidades: 3, valor: 90_000 }]);
    assert.deepEqual(
      cortes.map((c) => [c.etiqueta, c.unidades]),
      [["Original", 0], ["1.1", 0], ["Imitación", 0], ["Versión", 0], ["Esencia", 3]],
    );
  });
  it("las ventas sin clasificación van al final como «Sin categoría»", () => {
    const cortes = completarCortes(CORTES_TIPO, [{ clave: null, unidades: 2, valor: 50_000 }]);
    assert.deepEqual(cortes.at(-1), { clave: "SIN_CATEGORIA", etiqueta: "Sin categoría", unidades: 2, valor: 50_000 });
    assert.equal(completarCortes(CORTES_TIPO, []).length, 5);
  });
});

describe("marcas: top + Otras", () => {
  const filas = [
    ...Array.from({ length: 10 }, (_, i) => ({ clave: `m${i}`, etiqueta: `Marca ${i}`, unidades: 1, valor: (i + 1) * 1000 })),
    { clave: null, unidades: 4, valor: 999_999 },
  ];
  it("ordena de mayor a menor valor y deja «Sin categoría» al final", () => {
    const orden = ordenarCortes(filas);
    assert.equal(orden[0].etiqueta, "Marca 9");
    assert.equal(orden.at(-1)?.etiqueta, "Sin categoría");
  });
  it("deja 8 marcas, suma el resto en «Otras» y no pierde dinero", () => {
    const top = topConOtras(ordenarCortes(filas), 8);
    assert.equal(top.length, 10); // 8 + Otras + Sin categoría
    assert.deepEqual(top[8], { clave: "OTRAS", etiqueta: "Otras (2)", unidades: 2, valor: 3000 });
    const total = (l: { valor: number }[]) => l.reduce((a, c) => a + c.valor, 0);
    assert.equal(total(top), total(filas));
  });
  it("con 8 o menos no agrega «Otras»", () => {
    assert.equal(topConOtras(ordenarCortes(filas.slice(0, 8)), 8).some((c) => c.clave === "OTRAS"), false);
  });
});

describe("utilidades", () => {
  it("hayDatos detecta listas en cero", () => {
    assert.equal(hayDatos(completarCortes(CORTES_TIPO, [])), false);
    assert.equal(hayDatos([{ unidades: 0, valor: 1 }]), true);
  });
  it("pesosCorto abrevia miles y millones", () => {
    assert.equal(pesosCorto(0), "$ 0");
    assert.equal(pesosCorto(350_000), "$ 350 mil");
    assert.equal(pesosCorto(1_200_000), "$ 1,2 M");
    assert.equal(pesosCorto(3_000_000), "$ 3 M");
  });
});
