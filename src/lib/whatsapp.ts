/**
 * Texto y enlace para enviar una factura por WhatsApp.
 * Son funciones puras (sin navegador ni base de datos), por eso tienen pruebas unitarias.
 * WhatsApp no permite adjuntar imágenes desde un enlace: solo se puede llenar el texto.
 */
import { fechaHora, numeroFactura, pesos } from "./formato";
import { textoMedioPago } from "./pagos";
import type { FacturaDetalle } from "@/tipos";

/** Intl usa espacios especiales ("$ 150.000"); en un mensaje de texto deben ser normales. */
const plano = (texto: string) => texto.replace(/[\u00a0\u202f]/g, " ");
const dinero = (valor: number) => plano(pesos(valor));
const fechaYHora = (valor: string) => plano(fechaHora(valor));

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

/** Línea del medio de pago. Los créditos se pagan con abonos, por eso no tienen medio propio. */
function lineaPago(f: FacturaDetalle): string {
  if (!f.medioPago) return `Pago: Crédito en ${f.cuotas.length} ${f.cuotas.length === 1 ? "cuota" : "cuotas"}`;
  if (f.medioPago === "MIXTO") {
    return `Pago: Mixto (efectivo ${dinero(f.valorEfectivo)} + transferencia ${dinero(f.valorTransferencia)})`;
  }
  return `Pago: ${textoMedioPago(f.medioPago)}`;
}

export function mensajeFactura(f: FacturaDetalle): string {
  const separador = "———";
  const lineas = [
    `¡Hola ${f.clienteNombre}! Gracias por tu compra en ${f.local.nombre} 💜`,
    `Factura N° ${numeroFactura(f.numero)} · ${fechaYHora(f.creadoEn)}`,
    separador,
    ...f.items.map((i) => `• ${i.nombreProducto} x${i.cantidad} — ${dinero(i.subtotal)}`),
    separador,
    `Subtotal: ${dinero(f.subtotal)}`,
  ];

  if (f.adicional > 0) lineas.push(`Costo adicional: ${dinero(f.adicional)}`);
  if (f.descuento > 0) lineas.push(`Descuento: − ${dinero(f.descuento)}`);
  lineas.push(`*TOTAL: ${dinero(f.total)}*`, lineaPago(f));

  if (f.tipo === "CREDITO") {
    lineas.push(
      "Cuotas:",
      ...f.cuotas.map((c) => `• Cuota ${c.numero}: ${fechaYHora(c.fechaVencimiento)} — ${dinero(c.valor)}`),
      `Total abonado: ${dinero(f.total - f.saldo)}`,
      `Saldo pendiente: ${dinero(f.saldo)}`,
    );
  }

  lineas.push(`Atendido por ${f.vendedorNombre}. ¡Te esperamos pronto!`);
  return lineas.join("\n");
}

/** Enlace wa.me con el mensaje listo, o null si el teléfono de la factura no sirve. */
export function enlaceWhatsApp(f: FacturaDetalle): string | null {
  const numero = numeroWhatsApp(f.clienteTelefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensajeFactura(f))}` : null;
}
