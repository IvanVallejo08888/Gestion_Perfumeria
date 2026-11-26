/** Pruebas de la imagen de la factura (escala y conversión a archivo): npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AREA_MAXIMA_LIENZO, ESCALA_IMAGEN_FACTURA, LADO_MAXIMO_LIENZO, dataUrlABlob, escalaImagenFactura } from "./imagen-factura";

describe("escalaImagenFactura", () => {
  it("una factura corta usa la escala completa", () => {
    assert.equal(escalaImagenFactura(440, 900), ESCALA_IMAGEN_FACTURA);
  });

  it("una factura muy larga baja la escala para no pasar el área máxima del lienzo", () => {
    const escala = escalaImagenFactura(440, 9000);
    assert.ok(escala < ESCALA_IMAGEN_FACTURA);
    assert.ok(440 * escala * 9000 * escala <= AREA_MAXIMA_LIENZO);
  });

  it("ningún lado pasa del máximo del lienzo", () => {
    const escala = escalaImagenFactura(440, 12_000);
    assert.ok(12_000 * escala <= LADO_MAXIMO_LIENZO || escala === 1);
  });

  it("nunca baja de 1 (se prefiere la imagen completa a una ilegible)", () => {
    assert.equal(escalaImagenFactura(440, 100_000), 1);
  });

  it("si la medida no es válida devuelve la escala pedida", () => {
    assert.equal(escalaImagenFactura(0, 0), ESCALA_IMAGEN_FACTURA);
  });
});

describe("dataUrlABlob", () => {
  it("convierte la imagen en un archivo con su tipo y sus bytes (sin fetch)", async () => {
    // PNG de 1x1 píxel
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const blob = dataUrlABlob(`data:image/png;base64,${base64}`);
    assert.equal(blob.type, "image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join(""), "PNG");
    assert.equal(bytes.length, Buffer.from(base64, "base64").length);
  });
});
