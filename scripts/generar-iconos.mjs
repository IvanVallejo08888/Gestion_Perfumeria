/**
 * Genera los íconos PNG de la PWA a partir de src/app/icon.svg.
 * Uso: npm run iconos
 *
 * - icon-*.png: ícono normal (conserva las esquinas redondeadas y transparentes).
 * - icon-maskable-*.png: fondo vino de borde a borde y el dibujo reducido, para que
 *   Android pueda recortarlo en círculo u otra forma sin cortar la botella.
 *   (La zona segura es un círculo del 80 % del ancho.)
 * - apple-touch-icon.png: sin transparencia, porque iOS pinta de negro lo transparente.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = path.join(RAIZ, "src", "app", "icon.svg");
const DESTINO = path.join(RAIZ, "public", "icons");

const COLOR_MARCA = "#530309";
/** Proporción del ícono maskable que ocupa el dibujo */
const ESCALA_MASKABLE = 0.8;
/** Ancho del viewBox de icon.svg */
const ANCHO_SVG = 64;

const svg = await readFile(ORIGEN);

/** Dibuja el SVG al tamaño pedido. La densidad evita que se vea borroso al ampliarlo. */
const dibujar = (tamano) => sharp(svg, { density: (72 * tamano) / ANCHO_SVG }).resize(tamano, tamano);

async function iconoNormal(tamano, archivo) {
  await dibujar(tamano).png().toFile(path.join(DESTINO, archivo));
}

async function iconoSinTransparencia(tamano, archivo) {
  await dibujar(tamano).flatten({ background: COLOR_MARCA }).png().toFile(path.join(DESTINO, archivo));
}

async function iconoMaskable(tamano, archivo) {
  const interior = await dibujar(Math.round(tamano * ESCALA_MASKABLE)).png().toBuffer();
  await sharp({ create: { width: tamano, height: tamano, channels: 4, background: COLOR_MARCA } })
    .composite([{ input: interior, gravity: "center" }])
    .png()
    .toFile(path.join(DESTINO, archivo));
}

await mkdir(DESTINO, { recursive: true });
await Promise.all([
  iconoNormal(192, "icon-192.png"),
  iconoNormal(512, "icon-512.png"),
  iconoMaskable(192, "icon-maskable-192.png"),
  iconoMaskable(512, "icon-maskable-512.png"),
  iconoSinTransparencia(180, "apple-touch-icon.png"),
]);

console.log("Íconos generados en public/icons/");
