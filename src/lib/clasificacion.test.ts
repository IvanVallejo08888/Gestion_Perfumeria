/** Pruebas de las etiquetas de clasificación de perfumes. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORIAS_FORMULARIO, describirClasificacion, ETIQUETA_TIPO, etiquetaPara, GRUPOS_MILILITROS, SIN_CATEGORIA, textoMl, textoMlConOz, textoOz } from "./clasificacion";

describe("etiquetas de clasificación", () => {
  it("los tipos se muestran como en el local", () => {
    assert.equal(ETIQUETA_TIPO.UNO_UNO, "1.1");
    assert.equal(ETIQUETA_TIPO.IMITACION, "Imitación");
  });
  it("el contenido se muestra en mililitros", () => {
    assert.equal(textoMl(100), "100 ml");
  });
  it("muestra los ml con su equivalente comercial en onzas", () => {
    assert.equal(textoMlConOz(100), "100 ml (3.4 oz)");
    assert.equal(textoMlConOz(120), "120 ml (4 oz)");
    assert.equal(textoMlConOz(40), "40 ml (1 oz)");
    assert.equal(textoOz(250), "8.4 oz");
    assert.equal(textoOz(35), "1.2 oz", "un tamaño poco común se calcula");
  });
  it("el selector trae cada tamaño una sola vez y de menor a mayor", () => {
    const todos = GRUPOS_MILILITROS.flatMap((g) => g.mililitros);
    assert.deepEqual(todos, [...todos].sort((a, b) => a - b));
    assert.equal(new Set(todos).size, todos.length);
  });
  it("el formulario no ofrece Body Mist, Desodorante, Decant ni Accesorio", () => {
    assert.deepEqual([...CATEGORIAS_FORMULARIO], ["PERFUME", "ESTUCHE", "CREMA", "OTRO"]);
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
