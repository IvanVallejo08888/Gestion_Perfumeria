/**
 * Límite de intentos: frena ataques de fuerza bruta (probar muchas contraseñas)
 * y la creación masiva de cuentas falsas.
 *
 * Funciona con contadores por "clave" guardados en la tabla limite_intentos:
 *  - Cada fallo suma 1 dentro de una ventana de tiempo (por ejemplo, 15 minutos).
 *  - Al llegar al máximo, la clave queda bloqueada un tiempo y el contador vuelve a 0.
 *  - Mientras está bloqueada, la petición se rechaza ANTES de revisar la contraseña
 *    (así tampoco se gasta el trabajo de bcrypt, que es costoso a propósito).
 */
import "server-only";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { limiteIntentos } from "@/db/schema";
import { ApiError } from "@/lib/api";

export interface Regla {
  /** Intentos permitidos dentro de la ventana. */
  maximo: number;
  /** Duración de la ventana en la que se cuentan los intentos (minutos). */
  ventanaMin: number;
  /** Tiempo de bloqueo al superar el máximo (minutos). */
  bloqueoMin: number;
}

/** Reglas de la aplicación. Ajustarlas aquí cambia la protección en todos los endpoints. */
export const REGLAS = {
  /** Contraseña equivocada para una misma identificación. */
  loginPorCuenta: { maximo: 5, ventanaMin: 15, bloqueoMin: 15 },
  /** Contraseñas equivocadas desde un mismo equipo/red (protege si prueban muchas cuentas). */
  loginPorIp: { maximo: 20, ventanaMin: 15, bloqueoMin: 30 },
  /** Cuentas creadas desde un mismo equipo/red. */
  registroPorIp: { maximo: 5, ventanaMin: 60, bloqueoMin: 60 },
  /** "Contraseña actual" equivocada al cambiar la propia contraseña. */
  passwordPorUsuario: { maximo: 5, ventanaMin: 15, bloqueoMin: 15 },
} satisfies Record<string, Regla>;

/**
 * IP de quien hace la petición.
 * Detrás de un proxy o hosting (Vercel, Nginx, Cloudflare) llega en "x-forwarded-for";
 * el primer valor es el cliente original.
 * OJO: si la app se publica SIN proxy delante, este encabezado lo puede inventar el cliente;
 * en ese caso el límite por cuenta sigue funcionando, pero el límite por IP se puede evadir.
 */
export function ipDe(req: NextRequest): string {
  const reenviada = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || req.headers.get("x-real-ip")?.trim() || "desconocida";
}

/** Rechaza la petición (429) si alguna de las claves está bloqueada. */
export async function verificarBloqueo(claves: string[]) {
  const bloqueos = await db
    .select({ hasta: limiteIntentos.bloqueadoHasta })
    .from(limiteIntentos)
    .where(and(inArray(limiteIntentos.clave, claves), gt(limiteIntentos.bloqueadoHasta, sql`now()`)));

  const hasta = bloqueos.reduce<Date | null>((max, b) => (b.hasta && (!max || b.hasta > max) ? b.hasta : max), null);
  if (hasta) throw new ApiError(429, mensajeBloqueo(hasta));
}

/**
 * Suma un intento a la clave. Si llega al máximo, la bloquea.
 * Devuelve true si este intento produjo el bloqueo.
 */
export async function registrarIntento(clave: string, regla: Regla): Promise<boolean> {
  // Si la ventana anterior ya venció, el contador empieza de nuevo en 1
  const ventanaVencida = sql`${limiteIntentos.desde} < now() - make_interval(mins => ${regla.ventanaMin})`;

  const [fila] = await db
    .insert(limiteIntentos)
    .values({ clave, intentos: 1 })
    .onConflictDoUpdate({
      target: limiteIntentos.clave,
      set: {
        intentos: sql`case when ${ventanaVencida} then 1 else ${limiteIntentos.intentos} + 1 end`,
        desde: sql`case when ${ventanaVencida} then now() else ${limiteIntentos.desde} end`,
      },
    })
    .returning({ intentos: limiteIntentos.intentos });

  limpiarVencidos();

  if (fila.intentos < regla.maximo) return false;
  await db
    .update(limiteIntentos)
    .set({
      intentos: 0,
      desde: sql`now()`,
      bloqueadoHasta: sql`now() + make_interval(mins => ${regla.bloqueoMin})`,
    })
    .where(eq(limiteIntentos.clave, clave));
  return true;
}

/** Borra el contador de una clave (por ejemplo, después de un inicio de sesión correcto). */
export async function reiniciarIntentos(clave: string) {
  await db.delete(limiteIntentos).where(eq(limiteIntentos.clave, clave));
}

/**
 * De vez en cuando borra los contadores que ya no sirven (sin bloqueo vigente y con más
 * de un día). No se espera su resultado: no debe demorar ni romper la petición.
 */
function limpiarVencidos() {
  if (Math.random() > 0.05) return;
  db.delete(limiteIntentos)
    .where(
      and(
        lt(limiteIntentos.desde, sql`now() - interval '1 day'`),
        or(isNull(limiteIntentos.bloqueadoHasta), lt(limiteIntentos.bloqueadoHasta, sql`now()`)),
      ),
    )
    .catch((error) => console.error("[limite-intentos] No se pudieron limpiar contadores:", error));
}

function mensajeBloqueo(hasta: Date): string {
  const minutos = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
  return `Hubo demasiados intentos. Por seguridad, espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} e inténtalo de nuevo.`;
}
