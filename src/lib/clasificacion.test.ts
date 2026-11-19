/** Pruebas de las etiquetas de clasificación de perfumes. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describirClasificacion, ETIQUETA_TIPO, etiquetaPara, SIN_CATEGORIA, textoMl } from "./clasificacion";

describe("etiquetas de clasificación", () => {
  it("los tipos se muestran como en el local", () => {
    assert.equal(ETIQUETA_TIPO.UNO_UNO, "1.1");
    assert.equal(ETIQUETA_TIPO.IMITACION, "Imitación");
  });
  it("el contenido se muestra en mililitros", () => {
    assert.equal(textoMl(100), "100 ml");
  });
  it("Hombre/Mujer + Infantil = Niño/Niña", () => {
    assert.equal(etiquetaPara("HOMBRE", "INFANTIL"), "Niño");
    assert.equal(etiquetaPara("MUJER", "INFANTIL"), "Niña");
    assert.equal(etiquetaPara("MUJER", "ADULTO"), "Mujer");
    assert.equal(etiquetaPara("UNISEX", "ADULTO"), "Unisex");
    assert.equal(etiquetaPara("UNISEX", "INFANTIL"), "Infantil unisex");
  });
});

describe("describirClasificacion", () => {
  it("une los datos en orden: marca · tipo · género · concentración · ml", () => {
    assert.equal(
      describirClasificacion({ marcaNombre: "Dior", tipo: "ORIGINAL", genero: "HOMBRE", publico: "ADULTO", concentracion: "EDT", contenidoMl: 100 }),
      "Dior · Original · Hombre · EDT · 100 ml",
    );
  });
  it("sin ningún dato (facturas o productos antiguos) → Sin categoría", () => {
    assert.equal(describirClasificacion({}), SIN_CATEGORIA);
    assert.equal(describirClasificacion({ marcaNombre: null, tipo: null, genero: null, publico: null, contenidoMl: null }), SIN_CATEGORIA);
  });
});
