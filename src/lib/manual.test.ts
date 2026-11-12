/** Pruebas del manual de usuario (Ajustes → Manual de usuario). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MANUAL, seccionesPara, textosDe, tramos, type RolManual } from "./manual";

const ESPERADAS: Record<RolManual, number[]> = {
  VENDEDOR: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16],
  ADMIN: [1, 2, 3, 12, 13, 14, 15, 16],
};

describe("manual de usuario", () => {
  it("tiene las 16 secciones en orden", () => {
    assert.deepEqual(
      MANUAL.map((s) => s.numero),
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  for (const rol of ["VENDEDOR", "ADMIN"] as const) {
    it(`${rol} ve solo sus secciones`, () => {
      assert.deepEqual(
        seccionesPara(rol).map((s) => s.numero),
        ESPERADAS[rol],
      );
    });

    it(`${rol}: ninguna «sección N» apunta a una sección oculta`, () => {
      const visibles = new Set(ESPERADAS[rol]);
      for (const seccion of seccionesPara(rol)) {
        for (const texto of textosDe(seccion)) {
          for (const [, n] of texto.matchAll(/secci[oó]n (\d+)/gi)) {
            assert.ok(visibles.has(Number(n)), `Sección ${seccion.numero} menciona la sección ${n}: «${texto}»`);
          }
        }
      }
    });
  }

  it("no quedan textos pendientes ni el menú viejo «Mi cuenta»", () => {
    for (const seccion of MANUAL) {
      for (const texto of textosDe(seccion)) {
        assert.doesNotMatch(texto, /pendiente\./i);
        assert.doesNotMatch(texto, /toca \*\*Mi cuenta\*\*/);
      }
    }
  });

  it("las negritas están bien cerradas", () => {
    for (const seccion of MANUAL) {
      for (const texto of textosDe(seccion)) {
        assert.equal(texto.split("**").length % 2, 1, `Negrita sin cerrar: «${texto}»`);
      }
    }
  });
});

describe("tramos", () => {
  it("separa texto normal y negrita", () => {
    assert.deepEqual(tramos("Toca **Guardar** y listo"), [
      { texto: "Toca ", negrita: false },
      { texto: "Guardar", negrita: true },
      { texto: " y listo", negrita: false },
    ]);
  });

  it("acepta negrita al inicio", () => {
    assert.deepEqual(tramos("**Hoy**"), [{ texto: "Hoy", negrita: true }]);
  });
});
