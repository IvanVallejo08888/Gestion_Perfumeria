/**
 * Recalcula los textos de búsqueda con la versión actual de normalizarTexto.
 * Ejecutar una vez después de migrar:  npm run db:recalcular-busqueda
 *
 *  - productos.nombre_busqueda
 *  - facturas.cliente_nombre_busqueda
 *  - clientes.nombre_busqueda, nombre_compacto y telefono_digitos (buscador de Clientes)
 *
 * Se hace con un script (y no con SQL en la migración) para usar EXACTAMENTE la misma
 * función que usa la aplicación. Solo cambia esas columnas y se puede repetir sin riesgo.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { camposBusquedaCliente, normalizarTexto } from "../lib/formato";
import * as schema from "./schema";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const { productos, facturas, clientes } = schema;

  try {
    let productosCambiados = 0;
    const listaProductos = await db.select({ id: productos.id, nombre: productos.nombre, actual: productos.nombreBusqueda }).from(productos);
    for (const p of listaProductos) {
      const nombreBusqueda = normalizarTexto(p.nombre);
      if (nombreBusqueda === p.actual) continue;
      await db.update(productos).set({ nombreBusqueda }).where(eq(productos.id, p.id));
      productosCambiados++;
    }

    let facturasCambiadas = 0;
    const listaFacturas = await db
      .select({ id: facturas.id, nombre: facturas.clienteNombre, actual: facturas.clienteNombreBusqueda })
      .from(facturas);
    for (const f of listaFacturas) {
      const clienteNombreBusqueda = normalizarTexto(f.nombre);
      if (clienteNombreBusqueda === f.actual) continue;
      await db.update(facturas).set({ clienteNombreBusqueda }).where(eq(facturas.id, f.id));
      facturasCambiadas++;
    }

    let clientesCambiados = 0;
    const listaClientes = await db.select().from(clientes);
    for (const c of listaClientes) {
      const campos = camposBusquedaCliente(c.nombre, c.telefono);
      if (
        campos.nombreBusqueda === c.nombreBusqueda &&
        campos.nombreCompacto === c.nombreCompacto &&
        campos.telefonoDigitos === c.telefonoDigitos
      ) continue;
      await db.update(clientes).set(campos).where(eq(clientes.id, c.id));
      clientesCambiados++;
    }

    console.log(`✔ Productos actualizados: ${productosCambiados} de ${listaProductos.length}.`);
    console.log(`✔ Facturas actualizadas: ${facturasCambiadas} de ${listaFacturas.length}.`);
    console.log(`✔ Clientes actualizados: ${clientesCambiados} de ${listaClientes.length}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✖ Error recalculando la búsqueda:", error);
  process.exit(1);
});
