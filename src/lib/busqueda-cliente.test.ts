/** Pruebas de la búsqueda del cliente por cédula en la factura. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClienteDatos } from "@/tipos";
import {
  AYUDA_IDENTIFICACION,
  debeBuscarAlEscribir,
  estadoTrasBuscar,
  normalizarIdentificacion,
  puedeBuscarIdentificacion,
  resultadoBusqueda,
} from "./busqueda-cliente";
import { clienteSchema } from "./validaciones";

const IVAN: ClienteDatos = { identificacion: "1080044910", nombre: "Ivan vallejo", telefono: "3015999565", direccion: "Calle 1", sector: "Sur" };

describe("normalizarIdentificacion", () => {
  it("deja solo los dígitos (puntos, espacios, guiones y caracteres invisibles)", () => {
    assert.equal(normalizarIdentificacion("1.080.044.910"), "1080044910");
    assert.equal(normalizarIdentificacion(" 1080 044 910 "), "1080044910");
    assert.equal(normalizarIdentificacion("1080-044910​"), "1080044910");
  });
  it("la validación del cliente guarda la cédula normalizada", () => {
    const r = clienteSchema.parse({ ...IVAN, identificacion: "1.080.044.910" });
    assert.equal(r.identificacion, "1080044910");
  });
  it("la validación rechaza cédulas con menos de 5 dígitos aunque tengan puntos", () => {
    assert.equal(clienteSchema.safeParse({ ...IVAN, identificacion: "1.2.3" }).success, false);
  });
});

describe("cuándo buscar", () => {
  it("busca sola desde 6 dígitos (contando solo dígitos)", () => {
    assert.equal(debeBuscarAlEscribir("12345"), false);
    assert.equal(debeBuscarAlEscribir("123456"), true);
    assert.equal(debeBuscarAlEscribir("1.234.5"), false);
  });
  it("al salir del campo o con Enter busca desde 5 dígitos", () => {
    assert.equal(puedeBuscarIdentificacion("1234"), false);
    assert.equal(puedeBuscarIdentificacion("12345"), true);
  });
});

describe("resultadoBusqueda (servidor)", () => {
  it("prefiere el cliente del local", () => {
    assert.deepEqual(resultadoBusqueda(IVAN, { ...IVAN, nombre: "Otro" }), { cliente: IVAN, otroLocal: false });
  });
  it("si solo existe en otro local, lo ofrece marcado como de otro local", () => {
    assert.deepEqual(resultadoBusqueda(null, IVAN), { cliente: IVAN, otroLocal: true });
  });
  it("sin coincidencias: cliente nuevo", () => {
    assert.deepEqual(resultadoBusqueda(undefined, undefined), { cliente: null, otroLocal: false });
  });
});

describe("estadoTrasBuscar (factura)", () => {
  it("cliente del local → encontrado", () => {
    assert.equal(estadoTrasBuscar({ ok: true, respuesta: { cliente: IVAN, otroLocal: false } }), "encontrado");
  });
  it("cliente de otro local → ofrece usar sus datos", () => {
    const estado = estadoTrasBuscar({ ok: true, respuesta: { cliente: IVAN, otroLocal: true } });
    assert.equal(estado, "otro-local");
    assert.match(AYUDA_IDENTIFICACION[estado], /otro local/);
  });
  it("sin cliente → cliente nuevo", () => {
    assert.equal(estadoTrasBuscar({ ok: true, respuesta: { cliente: null, otroLocal: false } }), "nuevo");
  });
  it("error del servidor → mensaje de error, NO cliente nuevo", () => {
    const estado = estadoTrasBuscar({ ok: false });
    assert.equal(estado, "error");
    assert.equal(AYUDA_IDENTIFICACION[estado], "No se pudo buscar el cliente, intenta de nuevo.");
    assert.doesNotMatch(AYUDA_IDENTIFICACION[estado], /cliente nuevo/i);
  });
});
