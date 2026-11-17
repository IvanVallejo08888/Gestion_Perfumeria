/** Pruebas de las reglas de corrección de tamaños. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reglaParaProducto } from "./correccion-tamanos";

const tamano = (nombre: string, tipo: Parameters<typeof reglaParaProducto>[1] = null) => reglaParaProducto(nombre, tipo)?.tamano ?? null;

describe("corrección de tamaños", () => {
  it("cada perfume pedido recibe su tamaño, sin importar tildes ni mayúsculas", () => {
    assert.equal(tamano("BELUGA hombre", "VERSION"), "OZ_1");
    assert.equal(tamano("Aico", "ORIGINAL"), "OZ_1_6");
    assert.equal(tamano("Amore Mío"), "OZ_1_7");
    assert.equal(tamano("Lady Million"), "OZ_2_7");
    assert.equal(tamano("Lady Millon"), "OZ_2_7");
    assert.equal(tamano("Splash Lacoste"), "OZ_8_4");
  });

  it("Omnia Coral solo cambia si es original", () => {
    assert.equal(tamano("Omnia Coral", "ORIGINAL"), "OZ_2_2");
    assert.equal(tamano("Omnia Coral", "UNO_UNO"), null);
  });

  it("cremas 200 ml y esencias 1 oz (40 ml), aunque se llamen como un perfume", () => {
    assert.equal(tamano("Crema Vainilla"), "OZ_6_8");
    assert.equal(tamano("Afnan 9PM", "ESENCIA"), "OZ_1_40ML");
    assert.equal(tamano("Esencia Lady Million"), "OZ_1_40ML");
  });

  it("los demás productos no se tocan", () => {
    assert.equal(tamano("Dior Sauvage EDT", "ORIGINAL"), null);
    assert.equal(tamano("Lacoste Blanc", "ORIGINAL"), null);
    assert.equal(tamano("Recreación"), null);
  });
});
