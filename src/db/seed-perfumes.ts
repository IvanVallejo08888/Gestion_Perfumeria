/**
 * Catálogo de perfumes de EJEMPLO para un local.  Ejecutar con:
 *   npm run db:seed-perfumes -- "Nombre del local"
 *
 * Crea 8 marcas y 30 perfumes clasificados (ver datos-perfumes.ts).
 * Se puede repetir sin duplicar nada:
 *  - Una marca que ya existe en el local (sin importar mayúsculas) se deja como está.
 *  - Un perfume cuyo código (DEMO-01…DEMO-30) ya existe en el local se salta:
 *    no se pisan los cambios hechos a mano (precio, stock…).
 * No toca al administrador ni a ningún otro dato.
 */
import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { normalizarTexto } from "../lib/formato";
import { MARCAS_EJEMPLO, PERFUMES_EJEMPLO, precioEjemplo, STOCK_MINIMO_EJEMPLO } from "./datos-perfumes";
import * as schema from "./schema";

async function main() {
  const nombreLocal = process.argv.slice(2).join(" ").trim();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const { locales, marcas, productos } = schema;

  try {
    const listaLocales = await db.select({ id: locales.id, nombre: locales.nombre }).from(locales).orderBy(locales.nombre);
    const local = listaLocales.find((l) => l.nombre.toLowerCase() === nombreLocal.toLowerCase());
    if (!local) {
      console.error(nombreLocal ? `✖ No existe el local «${nombreLocal}».` : "✖ Falta el nombre del local.");
      console.error('  Uso: npm run db:seed-perfumes -- "Nombre del local"');
      console.error(
        listaLocales.length
          ? `  Locales disponibles: ${listaLocales.map((l) => `«${l.nombre}»`).join(", ")}`
          : "  Todavía no hay locales: créalo primero desde el panel del administrador.",
      );
      process.exitCode = 1;
      return;
    }

    const resultado = await db.transaction(async (tx) => {
      // Marcas: el índice único (local, lower(nombre)) descarta las que ya existen.
      const marcasNuevas = await tx
        .insert(marcas)
        .values(MARCAS_EJEMPLO.map((nombre) => ({ localId: local.id, nombre })))
        .onConflictDoNothing()
        .returning({ id: marcas.id });

      const filasMarcas = await tx
        .select({ id: marcas.id, nombre: marcas.nombre })
        .from(marcas)
        .where(
          and(
            eq(marcas.localId, local.id),
            inArray(
              sql`lower(${marcas.nombre})`,
              MARCAS_EJEMPLO.map((m) => m.toLowerCase()),
            ),
          ),
        );
      const idMarca = new Map(filasMarcas.map((m) => [m.nombre.toLowerCase(), m.id]));

      // Perfumes: el índice único (local, código) descarta los que ya existen.
      const productosNuevos = await tx
        .insert(productos)
        .values(
          PERFUMES_EJEMPLO.map((p) => {
            const marcaId = idMarca.get(p.marca.toLowerCase());
            if (!marcaId) throw new Error(`No se encontró la marca ${p.marca}.`);
            return {
              localId: local.id,
              nombre: p.nombre,
              nombreBusqueda: normalizarTexto(p.nombre),
              codigo: p.codigo,
              precio: precioEjemplo(p),
              stock: p.stock,
              stockMinimo: STOCK_MINIMO_EJEMPLO,
              marcaId,
              tipo: p.tipo,
              genero: p.genero,
              publico: p.publico,
              tamano: p.tamano,
            };
          }),
        )
        .onConflictDoNothing()
        .returning({ id: productos.id });

      return { marcas: marcasNuevas.length, productos: productosNuevos.length };
    });

    console.log(`✔ Local «${local.nombre}»`);
    console.log(`  Marcas: ${resultado.marcas} creadas, ${MARCAS_EJEMPLO.length - resultado.marcas} ya existían.`);
    console.log(`  Perfumes: ${resultado.productos} creados, ${PERFUMES_EJEMPLO.length - resultado.productos} ya existían.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✖ Error cargando los perfumes de ejemplo:", error);
  process.exit(1);
});
