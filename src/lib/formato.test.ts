/** Pruebas de la normalización de texto y de los rangos de fechas. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coincideBusqueda, escaparLike, fechaDia, hoyColombia, normalizarTexto, rangoDias } from "./formato";

describe("normalizarTexto", () => {
  it("quita tildes y pasa a minúsculas", () => {
    assert.equal(normalizarTexto("Perfúme ROSA"), "perfume rosa");
    assert.equal(normalizarTexto("ÁÉÍÓÚ áéíóú Üü"), "aeiou aeiou uu");
  });
  it("convierte la ñ en n", () => {
    assert.equal(normalizarTexto("Niño"), "nino");
    assert.equal(normalizarTexto("NIÑO"), "nino");
  });
  it("cambia signos y puntuación por espacios", () => {
    assert.equal(normalizarTexto("Agua-de.Rosa"), "agua de rosa");
    assert.equal(normalizarTexto("a.b,c-d_e/f'g\"h(i)j#k"), "a b c d e f g h i j k");
  });
  it("colapsa los espacios", () => {
    assert.equal(normalizarTexto("  agua   de  -  rosa  "), "agua de rosa");
  });
  it("conserva los números", () => {
    assert.equal(normalizarTexto("Rosa 100ml"), "rosa 100ml");
  });
  it("un texto de solo signos queda vacío", () => {
    assert.equal(normalizarTexto("-- . --"), "");
  });
});

describe("coincideBusqueda", () => {
  const busca = (nombre: string, texto: string, codigo?: string) => coincideBusqueda(nombre, codigo, texto);

  it("funciona en las dos direcciones", () => {
    assert.ok(busca("Perfúme Rosa", "perfume rosa"));
    assert.ok(busca("Perfúme Rosa", "PERFÚME"));
    assert.ok(busca("Perfume Rosa", "perfúme"));
    assert.ok(busca("Agua-de.rosa", "agua de rosa"));
    assert.ok(busca("Niño", "nino"));
    assert.ok(busca("Niño", "niño"));
    assert.ok(busca("Nino", "niño"));
  });
  it("acepta palabras en cualquier orden y desde la primera letra", () => {
    assert.ok(busca("Perfume Agua de Rosa", "rosa perf"));
    assert.ok(busca("Perfume", "p"));
  });
  it("todas las palabras deben estar", () => {
    assert.ok(!busca("Perfume Rosa", "rosa jazmin"));
  });
  it("también busca por código", () => {
    assert.ok(busca("Perfume", "ab-12", "AB-12"));
    assert.ok(!busca("Perfume", "zz", "AB-12"));
  });
});

describe("escaparLike", () => {
  it("escapa los comodines", () => {
    assert.equal(escaparLike("50%_a"), "50\\%\\_a");
  });
});

describe("fechas de los gastos", () => {
  it("hoyColombia usa la hora de Colombia, no la del servidor", () => {
    assert.equal(hoyColombia(new Date("2026-11-06T03:00:00Z")), "2026-11-05");
    assert.equal(hoyColombia(new Date("2026-11-06T06:00:00Z")), "2026-11-06");
  });
  it("rangoDias cubre un mes, diciembre y el año completo", () => {
    assert.deepEqual(rangoDias(2026, 2), { desde: "2026-02-01", hasta: "2026-03-01" });
    assert.deepEqual(rangoDias(2026, 12), { desde: "2026-12-01", hasta: "2027-01-01" });
    assert.deepEqual(rangoDias(2026), { desde: "2026-01-01", hasta: "2027-01-01" });
  });
  it("fechaDia muestra día/mes/año", () => {
    assert.equal(fechaDia("2026-11-05"), "05/11/2026");
  });
});
