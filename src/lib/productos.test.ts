/** Pruebas del nombre completo y de la búsqueda de productos. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coincideBusqueda } from "./formato";
import { armarNombreProducto, claveDuplicado, partirNombre, textoBusquedaProducto } from "./productos";

describe("armarNombreProducto", () => {
  it("arma el formato «Marca Nombre · Concentración ml · Género»", () => {
    assert.equal(
      armarNombreProducto({ marca: "Creed", nombre: "Aventus", concentracion: "EDP", contenidoMl: 100, genero: "HOMBRE" }),
      "Creed Aventus · EDP 100 ml · Hombre",
    );
  });
  it("incluye la variante después del nombre", () => {
    assert.equal(
      armarNombreProducto({ marca: "Carolina Herrera", nombre: "Good Girl", variante: "Blush", concentracion: "EDP", contenidoMl: 80, genero: "MUJER" }),
      "Carolina Herrera Good Girl Blush · EDP 80 ml · Mujer",
    );
  });
  it("sin género no deja separadores sobrantes", () => {
    assert.equal(
      armarNombreProducto({ marca: "Victoria's Secret", nombre: "Bombshell", concentracion: "BODY_MIST", contenidoMl: 250 }),
      "Victoria's Secret Bombshell · Body Mist 250 ml",
    );
  });
  it("estuche: prefijo de categoría y lo que trae al final", () => {
    assert.equal(
      armarNombreProducto({ marca: "Dior", nombre: "Sauvage", variante: "+ gel", concentracion: "EDT", contenidoMl: 100, categoria: "ESTUCHE" }),
      "Estuche Dior Sauvage · EDT 100 ml + gel",
    );
  });
  it("solo con el nombre", () => {
    assert.equal(armarNombreProducto({ nombre: "  Bolsa   de regalo " }), "Bolsa de regalo");
    assert.equal(armarNombreProducto({ marca: "", nombre: "Perfume 1.1", variante: null, contenidoMl: null }), "Perfume 1.1");
  });
  it("sin concentración muestra solo los ml; «Otro» no se escribe", () => {
    assert.equal(armarNombreProducto({ marca: "Perry Ellis", nombre: "360", contenidoMl: 100, genero: "HOMBRE" }), "Perry Ellis 360 · 100 ml · Hombre");
    assert.equal(armarNombreProducto({ marca: "Natura", nombre: "Kaiak", concentracion: "OTRO" }), "Natura Kaiak");
  });
  it("no repite la marca ni la categoría si el nombre ya las trae", () => {
    assert.equal(armarNombreProducto({ marca: "Dior", nombre: "Dior Sauvage", contenidoMl: 60 }), "Dior Sauvage · 60 ml");
    assert.equal(armarNombreProducto({ marca: "Dior", nombre: "Estuche Sauvage", categoria: "ESTUCHE" }), "Dior Estuche Sauvage");
  });
  it("público infantil y unisex", () => {
    assert.equal(armarNombreProducto({ nombre: "Princesa", genero: "MUJER", publico: "INFANTIL" }), "Princesa · Niña");
    assert.equal(armarNombreProducto({ marca: "CK", nombre: "One", genero: "UNISEX", publico: "ADULTO" }), "CK One · Unisex");
  });
});

describe("textoBusquedaProducto", () => {
  const aventus = textoBusquedaProducto({
    marca: "Creed",
    nombre: "Aventus",
    concentracion: "EDP",
    contenidoMl: 100,
    genero: "HOMBRE",
    publico: "ADULTO",
    categoria: "PERFUME",
    tipo: "ORIGINAL",
    codigo: "CR-100",
  });
  const sauvage = textoBusquedaProducto({ marca: "Dior", nombre: "Sauvage", concentracion: "EDT", contenidoMl: 100, genero: "HOMBRE" });
  const busca = (texto: string, enTexto: string) => coincideBusqueda(enTexto, null, texto);

  it("encuentra con cualquier combinación y en cualquier orden", () => {
    for (const q of ["aventus 100", "creed hombre", "edp 100ml", "EDP 100 ml", "hombre creed aventus", "eau de parfum", "original", "cr 100"]) {
      assert.ok(busca(q, aventus), `«${q}» debería encontrar Creed Aventus`);
    }
    for (const q of ["100 ml dior", "sauvage edt", "Sauvage EDT 100ML", "dior"]) {
      assert.ok(busca(q, sauvage), `«${q}» debería encontrar Dior Sauvage`);
    }
  });
  it("no encuentra lo que no corresponde", () => {
    assert.ok(!busca("aventus edt", aventus));
    assert.ok(!busca("mujer", aventus));
    assert.ok(!busca("sauvage 200", sauvage));
  });
  it("queda normalizado y sin palabras repetidas", () => {
    assert.equal(textoBusquedaProducto({ nombre: "Niño Ñandú", genero: "HOMBRE", publico: "ADULTO" }), "nino nandu hombre");
  });
});

describe("claveDuplicado", () => {
  it("ignora mayúsculas, tildes y espacios", () => {
    assert.equal(
      claveDuplicado({ marca: "Carolina Herrera", nombre: "Good  Girl", concentracion: "EDP", contenidoMl: 80 }),
      claveDuplicado({ marca: "carolina herrera", nombre: "good girl", variante: "", concentracion: "EDP", contenidoMl: 80 }),
    );
  });
  it("distingue el contenido y la concentración", () => {
    assert.notEqual(claveDuplicado({ marca: "Dior", nombre: "Sauvage", contenidoMl: 100 }), claveDuplicado({ marca: "Dior", nombre: "Sauvage", contenidoMl: 60 }));
    assert.notEqual(claveDuplicado({ marca: "Dior", nombre: "Sauvage", concentracion: "EDT" }), claveDuplicado({ marca: "Dior", nombre: "Sauvage", concentracion: "EDP" }));
  });
});

describe("partirNombre", () => {
  it("separa lo que es de cómo es", () => {
    assert.deepEqual(partirNombre("Creed Aventus · EDP 100 ml · Hombre"), ["Creed Aventus", "EDP 100 ml · Hombre"]);
    assert.deepEqual(partirNombre("Perfume 1.1"), ["Perfume 1.1", ""]);
  });
});
