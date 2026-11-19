/** Pruebas de los mensajes de validación del cliente. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { busquedaClienteSchema, clienteSchema } from "./validaciones";

function mensajes(datos: Record<string, string>) {
  const r = clienteSchema.safeParse(datos);
  assert.equal(r.success, false);
  return Object.fromEntries(r.error!.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("clienteSchema", () => {
  it("concuerda el género del mensaje de obligatorio", () => {
    const m = mensajes({ identificacion: "12345", nombre: "", telefono: "3001234567", direccion: "", sector: "" });
    assert.equal(m.direccion, "La dirección es obligatoria.");
    assert.equal(m.nombre, "El nombre del cliente es obligatorio.");
    assert.equal(m.sector, "El sector es obligatorio.");
  });
  it("concuerda el género del mensaje de demasiado largo", () => {
    const m = mensajes({ identificacion: "12345", nombre: "Ana", telefono: "3001234567", direccion: "x".repeat(161), sector: "Centro" });
    assert.equal(m.direccion, "La dirección es demasiado larga.");
  });
});

describe("busquedaClienteSchema", () => {
  it("acepta un nombre de 2 letras o más y quita los espacios de los lados", () => {
    assert.equal(busquedaClienteSchema.parse({ nombre: "  ma " }).nombre, "ma");
    assert.equal(busquedaClienteSchema.parse({ nombre: "María Pérez" }).nombre, "María Pérez");
  });
  it("rechaza búsquedas vacías, de una letra o demasiado largas", () => {
    assert.equal(busquedaClienteSchema.safeParse({}).success, false);
    assert.equal(busquedaClienteSchema.safeParse({ nombre: " m " }).success, false);
    assert.equal(busquedaClienteSchema.safeParse({ nombre: "a".repeat(101) }).success, false);
  });
});
