/**
 * Corrige el tamaño de los productos que quedaron mal registrados
 * (reglas en `src/lib/correccion-tamanos.ts`): Beluga, Aico, Amore Mio, Lady Million,
 * Splash Lacoste, Omnia Coral original, cremas y esencias.
 *
 * Por defecto SOLO muestra qué productos cambiarían. Para cambiarlos de verdad:
 *   npm run db:corregir-tamanos -- --confirmar
 *
 * Las facturas ya emitidas no cambian: guardan su propia copia del tamaño.
 * Requiere la migración 0007 (nuevos tamaños) aplicada antes: npm run db:migrate
 * Se hace con un script (y no en una migración) porque son datos, no estructura.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ETIQUETA_TAMANO, SIN_CATEGORIA } from "../lib/clasificacion";
import { reglaParaProducto } from "../lib/correccion-tamanos";
import * as schema from "./schema";

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const { productos, locales } = schema;

  try {
    await db.transaction(async (tx) => {
      const todos = await tx
        .select({ id: productos.id, nombre: productos.nombre, tipo: productos.tipo, tamano: productos.tamano, local: locales.nombre })
        .from(productos)
        .innerJoin(locales, eq(locales.id, productos.localId));

      const cambios = todos
        .map((p) => ({ ...p, regla: reglaParaProducto(p.nombre, p.tipo) }))
        .filter((p) => p.regla && p.regla.tamano !== p.tamano);

      if (!cambios.length) {
        console.log("Todos los productos ya tienen el tamaño correcto. No hay nada que cambiar.");
        return;
      }

      console.log(`Productos a corregir: ${cambios.length}\n`);
      for (const p of cambios) {
        const antes = p.tamano ? ETIQUETA_TAMANO[p.tamano] : SIN_CATEGORIA;
        console.log(`  [${p.local}] ${p.nombre}: ${antes} → ${ETIQUETA_TAMANO[p.regla!.tamano]}   (${p.regla!.descripcion})`);
      }

      if (!confirmar) {
        console.log("\nNo se cambió nada. Para aplicar: npm run db:corregir-tamanos -- --confirmar");
        return;
      }
      for (const p of cambios) {
        await tx.update(productos).set({ tamano: p.regla!.tamano, actualizadoEn: new Date() }).where(eq(productos.id, p.id));
      }
      console.log(`\n✔ ${cambios.length} productos corregidos.`);
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✖ Error corrigiendo tamaños:", error);
  process.exit(1);
});
