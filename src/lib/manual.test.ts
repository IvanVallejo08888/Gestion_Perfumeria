/** Pruebas del manual de usuario (Ajustes → Manual de usuario). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MANUAL, seccionesPara, textosDe, tramos, type RolManual } from "./manual";

/** Secciones del manual completo que ve cada rol (con su número original). */
const ORIGINALES: Record<RolManual, number[]> = {
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
    it(`${rol} ve solo sus secciones, en orden`, () => {
      const titulos = new Map(MANUAL.map((s) => [s.numero, s.titulo]));
      assert.deepEqual(
        seccionesPara(rol).map((s) => s.titulo),
        ORIGINALES[rol].map((n) => titulos.get(n)),
      );
    });

    it(`${rol}: las secciones van numeradas 1, 2, 3… sin saltos`, () => {
      assert.deepEqual(
        seccionesPara(rol).map((s) => s.numero),
        ORIGINALES[rol].map((_, i) => i + 1),
      );
    });

    it(`${rol}: toda «sección N» apunta a una sección que ve, con su número nuevo`, () => {
      const visibles = new Set(seccionesPara(rol).map((s) => s.numero));
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

describe("referencias renumeradas", () => {
  const textoDe = (rol: RolManual, titulo: string) =>
    textosDe(seccionesPara(rol).find((s) => s.titulo === titulo)!).join(" ");

  it("el vendedor ve «Mi cuenta y tamaño de letra» como sección 12 (en el manual completo es la 14)", () => {
    assert.match(textoDe("VENDEDOR", "Entrar y moverse por el sistema"), /\(sección 12\)/);
  });

  it("el administrador la ve como sección 6", () => {
    assert.match(textoDe("ADMIN", "Entrar y moverse por el sistema"), /\(sección 6\)/);
  });

  it("el manual completo no se modifica", () => {
    const original = MANUAL.find((s) => s.numero === 3)!;
    assert.match(textosDe(original).join(" "), /\(sección 14\)/);
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
