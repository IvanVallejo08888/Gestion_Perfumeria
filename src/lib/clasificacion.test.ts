/** Pruebas de las etiquetas de clasificación de perfumes. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describirClasificacion, ETIQUETA_TAMANO, ETIQUETA_TIPO, etiquetaPara, GRUPOS_TAMANO, SIN_CATEGORIA, TAMANOS } from "./clasificacion";

describe("etiquetas de clasificación", () => {
  it("los tipos se muestran como en el local", () => {
    assert.equal(ETIQUETA_TIPO.UNO_UNO, "1.1");
    assert.equal(ETIQUETA_TIPO.IMITACION, "Imitación");
  });
  it("todos los tamaños muestran onzas y mililitros", () => {
    assert.equal(ETIQUETA_TAMANO.OZ_3_4, "100 ml (3.4 oz)");
    for (const t of TAMANOS) assert.match(ETIQUETA_TAMANO[t], /^\d+ ml \(\d(\.\d)? oz\)$/);
  });
  it("los grupos del selector traen todos los tamaños, una vez y en orden", () => {
    assert.deepEqual(GRUPOS_TAMANO.flatMap((g) => g.tamanos), [...TAMANOS]);
  });
  it("incluye los tamaños de esencias, cremas y frascos pequeños", () => {
    assert.equal(ETIQUETA_TAMANO.OZ_1, "30 ml (1 oz)");
    assert.equal(ETIQUETA_TAMANO.OZ_1_40ML, "40 ml (1 oz)");
    assert.equal(ETIQUETA_TAMANO.OZ_6_8, "200 ml (6.8 oz)");
    assert.equal(ETIQUETA_TAMANO.OZ_8_4, "250 ml (8.4 oz)");
    assert.equal(new Set(Object.values(ETIQUETA_TAMANO)).size, TAMANOS.length, "las etiquetas no se repiten");
  });
  it("Hombre/Mujer + Infantil = Niño/Niña", () => {
    assert.equal(etiquetaPara("HOMBRE", "INFANTIL"), "Niño");
    assert.equal(etiquetaPara("MUJER", "INFANTIL"), "Niña");
    assert.equal(etiquetaPara("MUJER", "ADULTO"), "Mujer");
  });
});

describe("describirClasificacion", () => {
  it("une los datos en orden: marca · tipo · género · tamaño", () => {
    assert.equal(
      describirClasificacion({ marcaNombre: "Dior", tipo: "ORIGINAL", genero: "HOMBRE", publico: "ADULTO", tamano: "OZ_3_4" }),
      "Dior · Original · Hombre · 100 ml (3.4 oz)",
    );
  });
  it("sin ningún dato (facturas o productos antiguos) → Sin categoría", () => {
    assert.equal(describirClasificacion({}), SIN_CATEGORIA);
    assert.equal(describirClasificacion({ marcaNombre: null, tipo: null, genero: null, publico: null, tamano: null }), SIN_CATEGORIA);
  });
});
