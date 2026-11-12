/**
 * Borrador de la factura sin terminar.
 *
 * Se guarda en sessionStorage (sobrevive a recargas y a navegar por la app; se borra al cerrar
 * la pestaña o la sesión, y vence a las 12 horas) porque lleva datos personales del cliente.
 * Al restaurarlo, precio y stock se toman SIEMPRE del servidor: el borrador nunca es la fuente
 * de verdad (y el servidor vuelve a calcular todo al registrar).
 */
import { z } from "zod";
import { pesos } from "./formato";
import type { ClienteDatos, MedioPago, ProductoVenta, TipoFactura } from "@/tipos";

export const CLAVE_BORRADOR = "borrador-factura";
export const VIGENCIA_BORRADOR_MS = 12 * 60 * 60 * 1000;

export interface LineaBorrador {
  producto: ProductoVenta;
  cantidad: number;
}

export interface CuotasBorrador {
  cantidad: number;
  frecuencia: "semanal" | "quincenal" | "mensual";
  primera: string;
  fechas: string[];
}

export interface BorradorFactura {
  version: 1;
  guardadoEn: number;
  tipo: TipoFactura;
  cliente: ClienteDatos;
  lineas: LineaBorrador[];
  descuento: number;
  adicional: number;
  notas: string;
  medioPago: MedioPago | null;
  transferencia: number;
  cuotas: CuotasBorrador | null;
}

const entero = z.number().int().min(0);
const esquemaBorrador = z.object({
  version: z.literal(1),
  guardadoEn: z.number(),
  tipo: z.enum(["NORMAL", "CREDITO"]),
  cliente: z.object({
    identificacion: z.string(),
    nombre: z.string(),
    telefono: z.string(),
    direccion: z.string(),
    sector: z.string(),
  }),
  lineas: z.array(
    z.object({
      producto: z.object({ id: z.string(), nombre: z.string(), codigo: z.string().nullable(), precio: entero, stock: entero }),
      cantidad: z.number().int().min(1),
    }),
  ),
  descuento: entero,
  adicional: entero,
  notas: z.string(),
  medioPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "MIXTO"]).nullable(),
  transferencia: entero,
  cuotas: z
    .object({
      cantidad: z.number().int().min(1),
      frecuencia: z.enum(["semanal", "quincenal", "mensual"]),
      primera: z.string(),
      fechas: z.array(z.string()),
    })
    .nullable(),
});

/** Convierte el texto guardado en un borrador. Devuelve null si está dañado, es de otra versión o venció. */
export function leerBorrador(texto: string | null, ahora = Date.now()): BorradorFactura | null {
  if (!texto) return null;
  try {
    const r = esquemaBorrador.safeParse(JSON.parse(texto));
    if (!r.success) return null;
    if (ahora - r.data.guardadoEn > VIGENCIA_BORRADOR_MS || r.data.guardadoEn > ahora + 60_000) return null;
    return r.data as BorradorFactura;
  } catch {
    return null;
  }
}

/** Un borrador sin cliente, sin productos y sin notas no vale la pena guardarlo. */
export function borradorVacio(b: Pick<BorradorFactura, "cliente" | "lineas" | "notas">): boolean {
  return b.lineas.length === 0 && !b.notas.trim() && Object.values(b.cliente).every((v) => !v.trim());
}

/**
 * Ajusta las líneas guardadas con los productos actuales del servidor.
 * `frescos`: producto actual, `null` si ya no existe, o ausente si no se pudo verificar
 * (sin conexión): en ese caso se conserva lo guardado y el servidor lo revisa al registrar.
 */
export function reconciliarLineas(
  lineas: LineaBorrador[],
  frescos: Map<string, ProductoVenta | null>,
): { lineas: LineaBorrador[]; cambios: string[] } {
  const resultado: LineaBorrador[] = [];
  const cambios: string[] = [];
  for (const l of lineas) {
    if (!frescos.has(l.producto.id)) {
      resultado.push(l);
      continue;
    }
    const actual = frescos.get(l.producto.id);
    if (!actual) {
      cambios.push(`«${l.producto.nombre}» ya no está en el inventario y se quitó.`);
      continue;
    }
    if (actual.stock <= 0) {
      cambios.push(`«${actual.nombre}» se agotó y se quitó.`);
      continue;
    }
    if (actual.precio !== l.producto.precio) {
      cambios.push(`«${actual.nombre}» ahora cuesta ${pesos(actual.precio)} (antes ${pesos(l.producto.precio)}).`);
    }
    let cantidad = l.cantidad;
    if (cantidad > actual.stock) {
      cantidad = actual.stock;
      cambios.push(`De «${actual.nombre}» solo quedan ${actual.stock}: se ajustó la cantidad.`);
    }
    resultado.push({ producto: actual, cantidad });
  }
  return { lineas: resultado, cambios };
}

/** Las cuotas guardadas solo sirven si todas sus fechas siguen siendo futuras. */
export function cuotasVigentes(cuotas: CuotasBorrador | null, ahora = Date.now()): CuotasBorrador | null {
  if (!cuotas || cuotas.fechas.length === 0) return null;
  const validas = cuotas.fechas.every((f) => {
    const t = new Date(f).getTime();
    return !Number.isNaN(t) && t > ahora;
  });
  return validas ? cuotas : null;
}

/* ------------------------- Almacenamiento (navegador) ------------------------- */
// Todo va en try/catch: en modo privado o con el almacenamiento bloqueado, la app sigue funcionando.

export function cargarBorradorGuardado(): BorradorFactura | null {
  try {
    return leerBorrador(sessionStorage.getItem(CLAVE_BORRADOR));
  } catch {
    return null;
  }
}

export function guardarBorradorFactura(b: Omit<BorradorFactura, "version" | "guardadoEn">): void {
  try {
    if (borradorVacio(b)) sessionStorage.removeItem(CLAVE_BORRADOR);
    else sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ ...b, version: 1, guardadoEn: Date.now() }));
  } catch {
    /* sin almacenamiento: no se guarda */
  }
}

export function borrarBorradorFactura(): void {
  try {
    sessionStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* sin almacenamiento */
  }
}
