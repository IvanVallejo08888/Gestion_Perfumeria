/** Pruebas de las reglas del inventario (estado de stock y filtros en la URL). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contarFiltros, estadoStock, filtrosAUrl, leerFiltros } from "./inventario";

describe("estado del stock", () => {
  it("0 es agotado, hasta el mínimo es bajo y más es disponible", () => {
    assert.equal(estadoStock(0, 3), "AGOTADO");
    assert.equal(estadoStock(1, 3), "BAJO");
    assert.equal(estadoStock(3, 3), "BAJO");
    assert.equal(estadoStock(4, 3), "DISPONIBLE");
  });
  it("con mínimo 0, una unidad ya está disponible", () => {
    assert.equal(estadoStock(1, 0), "DISPONIBLE");
  });
});

describe("filtros en la URL", () => {
  it("ida y vuelta conserva los filtros válidos", () => {
    const url = "?q=yara&genero=MUJER&publico=INFANTIL&tipo=ORIGINAL&tamano=OZ_3_4&stock=BAJO";
    const filtros = leerFiltros(new URLSearchParams(url));
    assert.deepEqual(filtros, { q: "yara", genero: "MUJER", publico: "INFANTIL", tipo: "ORIGINAL", tamano: "OZ_3_4", stock: "BAJO" });
    assert.equal(filtrosAUrl(filtros), url);
  });
  it("ignora valores que no existen", () => {
    assert.deepEqual(leerFiltros(new URLSearchParams("?genero=OTRO&tipo=X&stock=&tamano=OZ_9")), {});
  });
  it("el público solo aplica dentro de una pestaña de género", () => {
    assert.deepEqual(leerFiltros(new URLSearchParams("?publico=INFANTIL")), {});
  });
  it("sin filtros la URL queda limpia", () => {
    assert.equal(filtrosAUrl({}), "");
  });
  it("cuenta solo los filtros del panel (no pestaña, chip ni buscador)", () => {
    assert.equal(contarFiltros({ q: "a", genero: "HOMBRE", publico: "ADULTO" }), 0);
    assert.equal(contarFiltros({ marcaId: "x", tipo: "ESENCIA", stock: "AGOTADO" }), 3);
  });
});
