/** Pruebas del catálogo de perfumes de ejemplo. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etiquetaPara, TAMANOS, TIPOS_PRODUCTO } from "../lib/clasificacion";
import { MARCAS_EJEMPLO, PERFUMES_EJEMPLO, PRECIOS_EJEMPLO, precioEjemplo, STOCK_MINIMO_EJEMPLO } from "./datos-perfumes";

describe("catálogo de perfumes de ejemplo", () => {
  it("tiene 8 marcas y 30 perfumes", () => {
    assert.equal(MARCAS_EJEMPLO.length, 8);
    assert.equal(PERFUMES_EJEMPLO.length, 30);
  });

  it("usa todas las marcas, tipos y tamaños", () => {
    for (const m of MARCAS_EJEMPLO) assert.ok(PERFUMES_EJEMPLO.some((p) => p.marca === m), `falta la marca ${m}`);
    for (const t of TIPOS_PRODUCTO) assert.ok(PERFUMES_EJEMPLO.some((p) => p.tipo === t), `falta el tipo ${t}`);
    for (const t of TAMANOS) assert.ok(PERFUMES_EJEMPLO.some((p) => p.tamano === t), `falta el tamaño ${t}`);
  });

  it("cubre Hombre, Mujer, Niño y Niña", () => {
    const publicos = new Set(PERFUMES_EJEMPLO.map((p) => etiquetaPara(p.genero, p.publico)));
    assert.deepEqual([...publicos].sort(), ["Hombre", "Mujer", "Niña", "Niño"]);
  });

  it("los códigos no se repiten", () => {
    assert.equal(new Set(PERFUMES_EJEMPLO.map((p) => p.codigo)).size, PERFUMES_EJEMPLO.length);
  });

  it("precios enteros y Original > 1.1 > Versión/Imitación > Esencia", () => {
    const minimo = (tipos: (keyof typeof PRECIOS_EJEMPLO)[]) => Math.min(...tipos.flatMap((t) => Object.values(PRECIOS_EJEMPLO[t])));
    const maximo = (tipos: (keyof typeof PRECIOS_EJEMPLO)[]) => Math.max(...tipos.flatMap((t) => Object.values(PRECIOS_EJEMPLO[t])));
    assert.ok(minimo(["ORIGINAL"]) > maximo(["UNO_UNO"]));
    assert.ok(minimo(["UNO_UNO"]) > maximo(["VERSION", "IMITACION"]));
    assert.ok(minimo(["VERSION", "IMITACION"]) > maximo(["ESENCIA"]));
    for (const p of PERFUMES_EJEMPLO) assert.ok(Number.isInteger(precioEjemplo(p)) && precioEjemplo(p) > 0);
  });

  it("3 agotados y 4 en stock bajo", () => {
    const agotados = PERFUMES_EJEMPLO.filter((p) => p.stock === 0);
    const bajos = PERFUMES_EJEMPLO.filter((p) => p.stock > 0 && p.stock <= STOCK_MINIMO_EJEMPLO);
    assert.equal(agotados.length, 3);
    assert.equal(bajos.length, 4);
  });
});
