/**
 * Texto y enlace para enviar una factura o un comprobante de abono por WhatsApp.
 * Son funciones puras (sin navegador ni base de datos), por eso tienen pruebas unitarias.
 * WhatsApp no permite adjuntar imágenes desde un enlace: solo se puede llenar el texto.
 *
 * Al cliente NO se le envían las cuotas ni sus fechas (son de uso interno: cobros y avisos);
 * solo lo que ha abonado y lo que le falta.
 */
import { fecha, fechaHora, numeroFactura, pesos } from "./formato";
import { textoMedioPago } from "./pagos";
import type { ComprobanteAbono, FacturaDetalle, MedioPago } from "@/tipos";

/** Intl usa espacios especiales ("$ 150.000"); en un mensaje de texto deben ser normales. */
export const plano = (texto: string) => texto.replace(/[  ]/g, " ");
const dinero = (valor: number) => plano(pesos(valor));
const fechaYHora = (valor: string) => plano(fechaHora(valor));
const SEPARADOR = "———";

/**
 * Convierte un teléfono al formato que pide wa.me: solo dígitos y con el indicativo 57.
 * Devuelve null si no es un celular colombiano válido.
 */
export function numeroWhatsApp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  if (/^573\d{9}$/.test(digitos)) return digitos;
  return null;
}

/** Enlace wa.me con el texto listo, o null si el teléfono no es un celular válido. */
function enlace(telefono: string, texto: string): string | null {
  const numero = numeroWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

/** "Pago: Efectivo" o "Pago: Mixto (efectivo $ … + transferencia $ …)". */
function lineaMedioPago(pago: { medioPago: MedioPago; valorEfectivo: number; valorTransferencia: number }): string {
  if (pago.medioPago === "MIXTO") {
    return `Pago: Mixto (efectivo ${dinero(pago.valorEfectivo)} + transferencia ${dinero(pago.valorTransferencia)})`;
  }
  return `Pago: ${textoMedioPago(pago.medioPago)}`;
}

/* -------------------------------- Factura -------------------------------- */

export function mensajeFactura(f: FacturaDetalle): string {
  const lineas = [
    `¡Hola ${f.clienteNombre}! Gracias por tu compra en ${f.local.nombre} 💜`,
    `Factura N° ${numeroFactura(f.numero)} · ${fechaYHora(f.creadoEn)}`,
    SEPARADOR,
    ...f.items.map((i) => `• ${i.nombreProducto} x${i.cantidad} — ${dinero(i.subtotal)}`),
    SEPARADOR,
    `Subtotal: ${dinero(f.subtotal)}`,
  ];

  if (f.adicional > 0) lineas.push(`Costo adicional: ${dinero(f.adicional)}`);
  if (f.descuento > 0) lineas.push(`Descuento: − ${dinero(f.descuento)}`);
  lineas.push(`*TOTAL: ${dinero(f.total)}*`);

  if (f.tipo === "CREDITO") {
    // Crédito: solo lo abonado y el saldo de HOY (sin cuotas ni fechas de cobro)
    const abonado = f.total - f.saldo;
    lineas.push("Pago: Crédito");
    if (abonado > 0) lineas.push(`Total abonado: ${dinero(abonado)}`);
    lineas.push(`*Saldo pendiente: ${dinero(f.saldo)}*`);
    if (f.estado === "COMPLETADA" && f.completadaEn) lineas.push(`✅ *Crédito pagado el ${plano(fecha(f.completadaEn))}*`);
  } else if (f.medioPago) {
    lineas.push(lineaMedioPago({ ...f, medioPago: f.medioPago }));
  }

  lineas.push("", `¡Gracias por tu compra! 💜 Te esperamos pronto en ${f.local.nombre}.`, `Atendido por ${f.vendedorNombre}.`);
  return lineas.join("\n");
}

/** Enlace wa.me con el mensaje de la factura, o null si el teléfono de la factura no sirve. */
export function enlaceWhatsApp(f: FacturaDetalle): string | null {
  return enlace(f.clienteTelefono, mensajeFactura(f));
}

/* --------------------------------- Abono --------------------------------- */

/** Mensaje del comprobante de abono. Si con este abono terminó de pagar, lo felicita. */
export function mensajeAbono(a: ComprobanteAbono): string {
  const lineas = [
    `¡Hola ${a.factura.clienteNombre}! Recibimos tu abono en ${a.local.nombre} 💜`,
    `Factura N° ${numeroFactura(a.factura.numero)}`,
    SEPARADOR,
    `Abono: *${dinero(a.valor)}*`,
    `Fecha: ${fechaYHora(a.creadoEn)}`,
    lineaMedioPago(a),
    SEPARADOR,
  ];

  if (a.saldo === 0) {
    lineas.push(
      "🎉 *¡Tu crédito quedó pagado por completo!*",
      `Total pagado: ${dinero(a.factura.total)}`,
      "",
      `¡Gracias por tu confianza y por cumplir con tus pagos! Te esperamos pronto en ${a.local.nombre} 💜`,
    );
  } else {
    lineas.push(
      `Total abonado: ${dinero(a.totalAbonado)} de ${dinero(a.factura.total)}`,
      `*Saldo pendiente: ${dinero(a.saldo)}*`,
      "",
      "¡Gracias por tu abono! 🙌",
    );
  }

  if (a.recibidoPor) lineas.push(`Recibido por ${a.recibidoPor}.`);
  return lineas.join("\n");
}

/** Enlace wa.me con el mensaje del abono, o null si el teléfono no sirve o el abono está anulado. */
export function enlaceWhatsAppAbono(a: ComprobanteAbono): string | null {
  if (a.anulado) return null;
  return enlace(a.factura.clienteTelefono, mensajeAbono(a));
}
