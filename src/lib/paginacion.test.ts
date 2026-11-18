/** Pruebas de los números de la paginación. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { numerosPagina } from "./paginacion";

describe("numerosPagina", () => {
  it("muestra todas cuando son pocas", () => {
    assert.deepEqual(numerosPagina(1, 1), [1]);
    assert.deepEqual(numerosPagina(2, 3), [1, 2, 3]);
  });
  it("resume el medio con «…»", () => {
    assert.deepEqual(numerosPagina(1, 7), [1, 2, 3, 4, "…", 7]);
    assert.deepEqual(numerosPagina(7, 7), [1, "…", 4, 5, 6, 7]);
    assert.deepEqual(numerosPagina(10, 20), [1, "…", 9, 10, 11, "…", 20]);
  });
  it("no oculta un solo número con «…»", () => {
    assert.deepEqual(numerosPagina(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  });
});
