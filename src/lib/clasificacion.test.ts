/** Pruebas de las etiquetas de clasificación de perfumes. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describirClasificacion, ETIQUETA_TAMANO, ETIQUETA_TIPO, etiquetaPara, SIN_CATEGORIA, TAMANOS } from "./clasificacion";

describe("etiquetas de clasificación", () => {
  it("los tipos se muestran como en el local", () => {
    assert.equal(ETIQUETA_TIPO.UNO_UNO, "1.1");
    assert.equal(ETIQUETA_TIPO.IMITACION, "Imitación");
  });
  it("todos los tamaños muestran onzas y mililitros", () => {
    assert.equal(ETIQUETA_TAMANO.OZ_3_4, "3.4 oz (100 ml)");
    for (const t of TAMANOS) assert.match(ETIQUETA_TAMANO[t], /^\d(\.\d)? oz \(\d+ ml\)$/);
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
      "Dior · Original · Hombre · 3.4 oz (100 ml)",
    );
  });
  it("sin ningún dato (facturas o productos antiguos) → Sin categoría", () => {
    assert.equal(describirClasificacion({}), SIN_CATEGORIA);
    assert.equal(describirClasificacion({ marcaNombre: null, tipo: null, genero: null, publico: null, tamano: null }), SIN_CATEGORIA);
  });
});
