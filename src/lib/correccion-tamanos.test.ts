/** Pruebas de las reglas de corrección de contenido (ml). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reglaParaProducto } from "./correccion-tamanos";

const tamano = (nombre: string, tipo: Parameters<typeof reglaParaProducto>[1] = null) => reglaParaProducto(nombre, tipo)?.mililitros ?? null;

describe("corrección de tamaños", () => {
  it("cada perfume pedido recibe su tamaño, sin importar tildes ni mayúsculas", () => {
    assert.equal(tamano("BELUGA hombre", "VERSION"), 30);
    assert.equal(tamano("Aico", "ORIGINAL"), 47);
    assert.equal(tamano("Amore Mío"), 50);
    assert.equal(tamano("Lady Million"), 80);
    assert.equal(tamano("Lady Millon"), 80);
    assert.equal(tamano("Splash Lacoste"), 250);
  });

  it("Omnia Coral solo cambia si es original", () => {
    assert.equal(tamano("Omnia Coral", "ORIGINAL"), 65);
    assert.equal(tamano("Omnia Coral", "UNO_UNO"), null);
  });

  it("cremas 200 ml y esencias 40 ml (1 oz), aunque se llamen como un perfume", () => {
    assert.equal(tamano("Crema Vainilla"), 200);
    assert.equal(tamano("Afnan 9PM", "ESENCIA"), 40);
    assert.equal(tamano("Esencia Lady Million"), 40);
  });

  it("los demás productos no se tocan", () => {
    assert.equal(tamano("Dior Sauvage EDT", "ORIGINAL"), null);
    assert.equal(tamano("Lacoste Blanc", "ORIGINAL"), null);
    assert.equal(tamano("Recreación"), null);
  });
});
