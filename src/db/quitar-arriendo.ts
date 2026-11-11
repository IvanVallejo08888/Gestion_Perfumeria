/**
 * Elimina el arriendo del sistema (el negocio no paga arriendo):
 *  - los gastos registrados con la categoría "Arriendo" (por la categoría o por la copia del nombre);
 *  - la categoría "Arriendo" de cada local.
 *
 * Por defecto SOLO muestra cuántos registros se borrarían. Para borrar de verdad:
 *   npm run db:quitar-arriendo -- --confirmar
 *
 * El borrado es definitivo y los totales de gastos de esos meses bajan en lo que sumaba el arriendo.
 * Se hace con un script (y no en una migración) porque son datos, no estructura.
 */
import "dotenv/config";
import { inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { pesos } from "../lib/formato";
import * as schema from "./schema";

const NOMBRE = "arriendo";

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const { categoriasGasto, gastos } = schema;

  try {
    await db.transaction(async (tx) => {
      const categorias = await tx
        .select({ id: categoriasGasto.id })
        .from(categoriasGasto)
        .where(sql`lower(trim(${categoriasGasto.nombre})) = ${NOMBRE}`);
      const ids = categorias.map((c) => c.id);

      const condicionGastos = or(
        sql`lower(trim(${gastos.categoriaNombre})) = ${NOMBRE}`,
        ids.length ? inArray(gastos.categoriaId, ids) : undefined,
      )!;
      const [resumen] = await tx
        .select({ cantidad: sql<number>`count(*)::int`, suma: sql<number>`coalesce(sum(${gastos.valor}), 0)::int` })
        .from(gastos)
        .where(condicionGastos);

      console.log(`Categorías "Arriendo" encontradas: ${ids.length}`);
      console.log(`Gastos de arriendo encontrados: ${resumen.cantidad} (suman ${pesos(resumen.suma)})`);

      if (!confirmar) {
        console.log("\nNo se borró nada. Para borrar: npm run db:quitar-arriendo -- --confirmar");
        return;
      }
      await tx.delete(gastos).where(condicionGastos);
      if (ids.length) await tx.delete(categoriasGasto).where(inArray(categoriasGasto.id, ids));
      console.log("\n✔ Arriendo eliminado.");
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✖ Error quitando el arriendo:", error);
  process.exit(1);
});
