/** Pruebas del mensaje y del enlace de WhatsApp. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FacturaDetalle } from "@/tipos";
import { enlaceWhatsApp, mensajeFactura, numeroWhatsApp } from "./whatsapp";

const base: FacturaDetalle = {
  id: "f1",
  numero: 123,
  tipo: "NORMAL",
  estado: "COMPLETADA",
  clienteNombre: "Ana Ruiz",
  clienteIdentificacion: "1085123456",
  clienteTelefono: "300 123 4567",
  clienteDireccion: "Calle 18 #25-30, barrio Las Cuadras",
  clienteSector: "Centro",
  vendedorNombre: "Luisa",
  total: 95000,
  saldo: 0,
  subtotal: 100000,
  adicional: 5000,
  descuento: 10000,
  medioPago: "MIXTO",
  valorEfectivo: 65000,
  valorTransferencia: 30000,
  notas: null,
  creadoEn: "2026-11-05T20:30:00.000Z",
  completadaEn: "2026-11-05T20:30:00.000Z",
  local: { nombre: "Perfumería Centro", direccion: null, telefono: null },
  items: [{ id: "i1", nombreProducto: "Agua de Rosa", precioUnitario: 50000, cantidad: 2, subtotal: 100000 }],
  cuotas: [],
  abonos: [],
};

describe("numeroWhatsApp", () => {
  it("antepone 57 a un celular de 10 dígitos que empieza por 3", () => {
    assert.equal(numeroWhatsApp("3001234567"), "573001234567");
  });
  it("quita espacios, guiones y signos", () => {
    assert.equal(numeroWhatsApp("300-123 4567"), "573001234567");
    assert.equal(numeroWhatsApp("(300) 123.4567"), "573001234567");
  });
  it("respeta el número que ya trae el indicativo", () => {
    assert.equal(numeroWhatsApp("+57 300 123 4567"), "573001234567");
  });
  it("rechaza teléfonos que no son celulares válidos", () => {
    assert.equal(numeroWhatsApp("7234567"), null);
    assert.equal(numeroWhatsApp("6012345678"), null);
    assert.equal(numeroWhatsApp("30012345"), null);
    assert.equal(numeroWhatsApp(""), null);
  });
});

describe("mensajeFactura", () => {
  it("arma el mensaje de una factura mixta con adicional y descuento", () => {
    const lineas = mensajeFactura(base).split("\n");
    assert.equal(lineas[0], "¡Hola Ana Ruiz! Gracias por tu compra en Perfumería Centro 💜");
    assert.match(lineas[1], /^Factura N° 000123 · 5 (de )?nov (de )?2026/);
    assert.equal(lineas[2], "———");
    assert.equal(lineas[3], "• Agua de Rosa x2 — $ 100.000");
    assert.equal(lineas[4], "———");
    assert.equal(lineas[5], "Subtotal: $ 100.000");
    assert.equal(lineas[6], "Costo adicional: $ 5.000");
    assert.equal(lineas[7], "Descuento: − $ 10.000");
    assert.equal(lineas[8], "*TOTAL: $ 95.000*");
    assert.equal(lineas[9], "Pago: Mixto (efectivo $ 65.000 + transferencia $ 30.000)");
    assert.equal(lineas.at(-1), "Atendido por Luisa. ¡Te esperamos pronto!");
  });

  it("omite el adicional y el descuento si no aplican", () => {
    const texto = mensajeFactura({ ...base, adicional: 0, descuento: 0, medioPago: "EFECTIVO" });
    assert.ok(!texto.includes("Costo adicional"));
    assert.ok(!texto.includes("Descuento"));
    assert.ok(texto.includes("Pago: Efectivo"));
  });

  it("no deja espacios especiales en el texto", () => {
    assert.ok(!/[\u00a0\u202f]/.test(mensajeFactura(base)));
  });

  it("en un crédito agrega cuotas, total abonado y saldo", () => {
    const texto = mensajeFactura({
      ...base,
      tipo: "CREDITO",
      estado: "PENDIENTE",
      medioPago: null,
      total: 90000,
      saldo: 60000,
      cuotas: [
        { id: "c1", numero: 1, fechaVencimiento: "2026-12-05T15:00:00.000Z", valor: 45000, valorPagado: 30000, estado: "PENDIENTE", pagadaEn: null },
        { id: "c2", numero: 2, fechaVencimiento: "2027-01-05T15:00:00.000Z", valor: 45000, valorPagado: 0, estado: "PENDIENTE", pagadaEn: null },
      ],
    });
    assert.ok(texto.includes("Pago: Crédito en 2 cuotas"));
    assert.match(texto, /• Cuota 1: 5 (de )?dic (de )?2026.* — \$ 45\.000/);
    assert.ok(texto.includes("Total abonado: $ 30.000"));
    assert.ok(texto.includes("Saldo pendiente: $ 60.000"));
  });
});

describe("enlaceWhatsApp", () => {
  it("usa el número 57 y el texto codificado", () => {
    const enlace = enlaceWhatsApp(base)!;
    assert.ok(enlace.startsWith("https://wa.me/573001234567?text="));
    assert.equal(decodeURIComponent(enlace.split("?text=")[1]), mensajeFactura(base));
  });
  it("devuelve null si el teléfono no es válido", () => {
    assert.equal(enlaceWhatsApp({ ...base, clienteTelefono: "7234567" }), null);
  });
});
