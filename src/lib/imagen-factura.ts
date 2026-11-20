/**
 * Escala (pixelRatio) para convertir la factura en imagen.
 * Se pide alta resolución (2.5), pero una factura larga puede pasar los límites del lienzo (canvas)
 * de los navegadores: 16.384 px por lado y unos 16,7 millones de píxeles en total en iPhone y
 * algunos Android. Pasado ese límite la imagen sale en blanco o incompleta, así que se baja la escala
 * lo justo para que quepa (nunca por debajo de 1).
 */

export const ESCALA_IMAGEN_FACTURA = 2.5;
export const LADO_MAXIMO_LIENZO = 16_384;
export const AREA_MAXIMA_LIENZO = 16_777_216;

/**
 * Convierte la imagen generada ("data:image/png;base64,…") en un archivo (Blob) sin usar fetch:
 * la política de seguridad (CSP, connect-src) no permite fetch("data:…") y con eso fallaba
 * «Compartir imagen» con el mensaje «No se pudo generar el archivo».
 */
export function dataUrlABlob(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(",");
  const cabecera = dataUrl.slice(0, coma);
  const tipo = /^data:([^;,]+)/.exec(cabecera)?.[1] ?? "application/octet-stream";
  const binario = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export function escalaImagenFactura(ancho: number, alto: number, deseada = ESCALA_IMAGEN_FACTURA): number {
  if (ancho <= 0 || alto <= 0) return deseada;
  const porLado = LADO_MAXIMO_LIENZO / Math.max(ancho, alto);
  const porArea = Math.sqrt(AREA_MAXIMA_LIENZO / (ancho * alto));
  // Se redondea hacia abajo a centésimas para no quedar justo encima del límite
  const escala = Math.floor(Math.min(deseada, porLado, porArea) * 100) / 100;
  return Math.max(1, escala);
}
