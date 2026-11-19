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

export function escalaImagenFactura(ancho: number, alto: number, deseada = ESCALA_IMAGEN_FACTURA): number {
  if (ancho <= 0 || alto <= 0) return deseada;
  const porLado = LADO_MAXIMO_LIENZO / Math.max(ancho, alto);
  const porArea = Math.sqrt(AREA_MAXIMA_LIENZO / (ancho * alto));
  // Se redondea hacia abajo a centésimas para no quedar justo encima del límite
  const escala = Math.floor(Math.min(deseada, porLado, porArea) * 100) / 100;
  return Math.max(1, escala);
}
