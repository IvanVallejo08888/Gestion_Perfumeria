/** Pruebas del mensaje y los enlaces de soporte (Ajustes → Quejas e inquietudes). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asuntoSoporte, describirNavegador, enlaceCorreoSoporte, enlaceWhatsAppSoporte, mensajeSoporte, type DatosTecnicos } from "./soporte";
import { quejaSchema, type Queja } from "./validaciones";

const queja: Queja = { tipo: "ERROR", pantalla: "facturacion", descripcion: "  No me deja guardar la factura  " };

const datos: DatosTecnicos = {
  nombre: "Luisa",
  rol: "VENDEDOR",
  local: "Local Centro",
  fecha: new Date("2026-11-11T20:24:00.000Z"),
  agente:
    "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  ancho: 360,
  alto: 800,
};

describe("describirNavegador", () => {
  it("reconoce Chrome en Android", () => {
    assert.equal(describirNavegador(datos.agente), "Chrome 131 · Android");
  });
  it("reconoce Edge en Windows (aunque su texto también dice Chrome)", () => {
    const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    assert.equal(describirNavegador(edge), "Edge 131 · Windows");
  });
  it("reconoce Safari en iPhone", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
    assert.equal(describirNavegador(safari), "Safari 18 · iOS");
  });
  it("no falla con un texto desconocido", () => {
    assert.equal(describirNavegador(""), "Navegador desconocido · Sistema desconocido");
  });
});

describe("mensajeSoporte", () => {
  it("incluye lo que escribió el usuario y los datos técnicos", () => {
    const lineas = mensajeSoporte(queja, datos).split("\n");
    assert.equal(lineas[0], "*Soporte · Gestión de Perfumerías*");
    assert.equal(lineas[1], "Tipo: Error");
    assert.equal(lineas[2], "Pantalla: Facturación");
    assert.equal(lineas[4], "No me deja guardar la factura");
    assert.equal(lineas[7], "• Usuario: Luisa (Vendedor)");
    assert.equal(lineas[8], "• Local: Local Centro");
    assert.match(lineas[9], /^• Fecha: 11 (de )?nov (de )?2026.*3:24/);
    assert.equal(lineas[10], "• Navegador: Chrome 131 · Android");
    assert.equal(lineas[11], "• Pantalla: 360 × 800 px");
  });
  it("muestra la hora de Colombia y sin espacios especiales", () => {
    const texto = mensajeSoporte(queja, datos);
    assert.ok(!/[  ]/.test(texto));
  });
  it("al administrador lo identifica como tal y sin local", () => {
    const texto = mensajeSoporte(queja, { ...datos, rol: "ADMIN", local: null });
    assert.ok(texto.includes("• Usuario: Luisa (Administrador)"));
    assert.ok(texto.includes("• Local: Administrador (todos los locales)"));
  });
});

describe("enlaces de soporte", () => {
  const mensaje = mensajeSoporte(queja, datos);
  it("WhatsApp: número colombiano con 57 y texto codificado", () => {
    const enlace = enlaceWhatsAppSoporte("300 123 4567", mensaje)!;
    assert.ok(enlace.startsWith("https://wa.me/573001234567?text="));
    assert.equal(decodeURIComponent(enlace.split("?text=")[1]), mensaje);
  });
  it("WhatsApp: null si el número falta o no es válido", () => {
    assert.equal(enlaceWhatsAppSoporte(undefined, mensaje), null);
    assert.equal(enlaceWhatsAppSoporte("{telefono}", mensaje), null);
  });
  it("correo: mailto con asunto y cuerpo", () => {
    const enlace = enlaceCorreoSoporte("soporte@ejemplo.com", asuntoSoporte(queja), mensaje)!;
    assert.ok(enlace.startsWith("mailto:soporte@ejemplo.com?subject="));
    const parametros = new URLSearchParams(enlace.split("?")[1]);
    assert.equal(parametros.get("subject"), "Error en Facturación · Gestión de Perfumerías");
    assert.equal(parametros.get("body"), mensaje);
  });
  it("correo: null si falta o no es válido", () => {
    assert.equal(enlaceCorreoSoporte(undefined, "a", "b"), null);
    assert.equal(enlaceCorreoSoporte("{correo}", "a", "b"), null);
  });
});

describe("quejaSchema", () => {
  it("acepta una queja completa", () => {
    assert.ok(quejaSchema.safeParse(queja).success);
  });
  it("exige mínimo 10 caracteres en la descripción (sin contar espacios de los bordes)", () => {
    const r = quejaSchema.safeParse({ ...queja, descripcion: "   corto   " });
    assert.ok(!r.success);
    assert.equal(r.error.issues[0].message, "Cuéntanos un poco más: escribe mínimo 10 caracteres.");
  });
  it("rechaza una pantalla que no existe", () => {
    assert.ok(!quejaSchema.safeParse({ ...queja, pantalla: "inventada" }).success);
  });
});
