/** Pruebas de los mensajes y enlaces de WhatsApp (factura y abono). Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AbonoDetalle, ComprobanteAbono, FacturaDetalle } from "@/tipos";
import { enlaceWhatsApp, enlaceWhatsAppAbono, mensajeAbono, mensajeFactura, numeroWhatsApp } from "./whatsapp";

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
  anulada: false,
  anuladaEn: null,
  anuladaPorNombre: null,
  motivoAnulacion: null,
  local: { nombre: "Perfumería Centro", direccion: null, telefono: null },
  items: [{ id: "i1", nombreProducto: "Agua de Rosa", precioUnitario: 50000, cantidad: 2, subtotal: 100000 }],
  cuotas: [],
  abonos: [],
};

/** Caso real: crédito de $ 140.000 de Ivan vallejo en Allure (con 2 cuotas guardadas internamente). */
const creditoNuevo: FacturaDetalle = {
  ...base,
  numero: 7,
  tipo: "CREDITO",
  estado: "PENDIENTE",
  clienteNombre: "Ivan vallejo",
  clienteTelefono: "3015999565",
  vendedorNombre: "Ivan Vallejo",
  subtotal: 140000,
  adicional: 0,
  descuento: 0,
  total: 140000,
  saldo: 140000,
  medioPago: null,
  valorEfectivo: 0,
  valorTransferencia: 0,
  creadoEn: "2026-11-20T07:00:00.000Z",
  completadaEn: null,
  local: { nombre: "Allure", direccion: null, telefono: null },
  items: [{ id: "i7", nombreProducto: "AFNAN 9 PM Elixir · 100 ml · Hombre", precioUnitario: 140000, cantidad: 1, subtotal: 140000 }],
  cuotas: [
    { id: "c1", numero: 1, fechaVencimiento: "2026-12-05T15:00:00.000Z", valor: 70000, valorPagado: 0, estado: "PENDIENTE", pagadaEn: null },
    { id: "c2", numero: 2, fechaVencimiento: "2027-01-05T15:00:00.000Z", valor: 70000, valorPagado: 0, estado: "PENDIENTE", pagadaEn: null },
  ],
  abonos: [],
};

function abonoDetalle(valor: number): AbonoDetalle {
  return { id: `a${valor}`, valor, medioPago: "EFECTIVO", valorEfectivo: valor, valorTransferencia: 0, nota: null, creadoEn: "2026-11-20T07:05:00.000Z" };
}

const abonoParcial: ComprobanteAbono = {
  id: "a1",
  numero: 1,
  valor: 10000,
  medioPago: "EFECTIVO",
  valorEfectivo: 10000,
  valorTransferencia: 0,
  creadoEn: "2026-11-20T07:05:00.000Z",
  anulado: false,
  recibidoPor: "Ivan Vallejo",
  totalAbonado: 10000,
  saldo: 130000,
  factura: { id: "f7", numero: 7, total: 140000, clienteNombre: "Ivan vallejo", clienteIdentificacion: "1080044910", clienteTelefono: "3015999565" },
  local: { nombre: "Allure", direccion: null, telefono: null },
};

/** Ningún texto que recibe el cliente debe hablar de cuotas. */
function sinCuotas(texto: string) {
  assert.ok(!/cuota/i.test(texto), `No debe incluir «Cuota»:\n${texto}`);
}

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
  it("factura de contado: mixta con adicional, descuento y el nuevo cierre", () => {
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
    assert.deepEqual(lineas.slice(10), ["", "¡Gracias por tu compra! 💜 Te esperamos pronto en Perfumería Centro.", "Atendido por Luisa."]);
    sinCuotas(mensajeFactura(base));
  });

  it("omite el adicional y el descuento si no aplican", () => {
    const texto = mensajeFactura({ ...base, adicional: 0, descuento: 0, medioPago: "EFECTIVO" });
    assert.ok(!texto.includes("Costo adicional"));
    assert.ok(!texto.includes("Descuento"));
    assert.ok(texto.includes("Pago: Efectivo"));
  });

  it("no deja espacios especiales en el texto", () => {
    assert.ok(!/[  ]/.test(mensajeFactura(base)));
    assert.ok(!/[  ]/.test(mensajeFactura(creditoNuevo)));
  });

  it("crédito sin abonos: formato completo, sin cuotas ni total abonado", () => {
    const lineas = mensajeFactura(creditoNuevo).split("\n");
    assert.equal(lineas[0], "¡Hola Ivan vallejo! Gracias por tu compra en Allure 💜");
    assert.match(lineas[1], /^Factura N° 000007 · 20 (de )?nov (de )?2026/);
    assert.deepEqual(lineas.slice(2), [
      "———",
      "• AFNAN 9 PM Elixir · 100 ml · Hombre x1 — $ 140.000",
      "———",
      "Subtotal: $ 140.000",
      "*TOTAL: $ 140.000*",
      "Pago: Crédito",
      "*Saldo pendiente: $ 140.000*",
      "",
      "¡Gracias por tu compra! 💜 Te esperamos pronto en Allure.",
      "Atendido por Ivan Vallejo.",
    ]);
    sinCuotas(mensajeFactura(creditoNuevo));
  });

  it("crédito con abonos: total abonado y saldo de hoy", () => {
    const texto = mensajeFactura({ ...creditoNuevo, saldo: 130000, abonos: [abonoDetalle(10000)] });
    assert.ok(texto.includes("Pago: Crédito\nTotal abonado: $ 10.000\n*Saldo pendiente: $ 130.000*"));
    sinCuotas(texto);
  });

  it("crédito pagado: saldo en cero y fecha de pago", () => {
    const texto = mensajeFactura({
      ...creditoNuevo,
      estado: "COMPLETADA",
      saldo: 0,
      completadaEn: "2026-11-21T15:00:00.000Z",
      abonos: [abonoDetalle(10000), abonoDetalle(130000)],
    });
    assert.ok(texto.includes("Total abonado: $ 140.000"));
    assert.ok(texto.includes("*Saldo pendiente: $ 0*"));
    assert.ok(texto.includes("✅ *Crédito pagado el 21/11/2026*"));
    sinCuotas(texto);
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

describe("mensajeAbono", () => {
  it("abono parcial: valor, fecha, medio, total abonado y saldo", () => {
    const texto = mensajeAbono(abonoParcial);
    const lineas = texto.split("\n");
    assert.equal(lineas[0], "¡Hola Ivan vallejo! Recibimos tu abono en Allure 💜");
    assert.equal(lineas[1], "Factura N° 000007");
    assert.equal(lineas[2], "———");
    assert.equal(lineas[3], "Abono: *$ 10.000*");
    assert.match(lineas[4], /^Fecha: 20 (de )?nov (de )?2026/);
    assert.deepEqual(lineas.slice(5), [
      "Pago: Efectivo",
      "———",
      "Total abonado: $ 10.000 de $ 140.000",
      "*Saldo pendiente: $ 130.000*",
      "",
      "¡Gracias por tu abono! 🙌",
      "Recibido por Ivan Vallejo.",
    ]);
    sinCuotas(texto);
    assert.ok(!/[  ]/.test(texto));
  });

  it("abono que completa el crédito: felicita y no muestra saldo pendiente", () => {
    const texto = mensajeAbono({ ...abonoParcial, numero: 2, valor: 130000, totalAbonado: 140000, saldo: 0 });
    const lineas = texto.split("\n");
    assert.equal(lineas[3], "Abono: *$ 130.000*");
    assert.deepEqual(lineas.slice(6), [
      "———",
      "🎉 *¡Tu crédito quedó pagado por completo!*",
      "Total pagado: $ 140.000",
      "",
      "¡Gracias por tu confianza y por cumplir con tus pagos! Te esperamos pronto en Allure 💜",
      "Recibido por Ivan Vallejo.",
    ]);
    assert.ok(!texto.includes("Saldo pendiente"));
    sinCuotas(texto);
  });

  it("abono mixto: muestra efectivo y transferencia", () => {
    const texto = mensajeAbono({ ...abonoParcial, medioPago: "MIXTO", valorEfectivo: 4000, valorTransferencia: 6000 });
    assert.ok(texto.includes("Pago: Mixto (efectivo $ 4.000 + transferencia $ 6.000)"));
    sinCuotas(texto);
  });

  it("si no se sabe quién lo recibió, omite esa línea", () => {
    assert.ok(!mensajeAbono({ ...abonoParcial, recibidoPor: null }).includes("Recibido por"));
  });
});

describe("enlaceWhatsAppAbono", () => {
  it("usa el mismo armado del número (57 + celular)", () => {
    const enlace = enlaceWhatsAppAbono(abonoParcial)!;
    assert.ok(enlace.startsWith("https://wa.me/573015999565?text="));
    assert.equal(decodeURIComponent(enlace.split("?text=")[1]), mensajeAbono(abonoParcial));
  });
  it("null si el teléfono no es válido o el abono está anulado", () => {
    assert.equal(enlaceWhatsAppAbono({ ...abonoParcial, factura: { ...abonoParcial.factura, clienteTelefono: "7234567" } }), null);
    assert.equal(enlaceWhatsAppAbono({ ...abonoParcial, anulado: true }), null);
  });
});
