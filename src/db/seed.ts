/**
 * Datos iniciales ("seed").  Ejecutar con:  npm run db:seed
 *
 * Crea el ÚNICO usuario administrador si todavía no existe.
 * Si ya existe, NO cambia su contraseña (por si la modificó desde la aplicación).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const identificacion = process.env.ADMIN_IDENTIFICACION ?? "12345987600";
  const password = process.env.ADMIN_PASSWORD ?? "AdministradorGestion2026$";
  const nombre = process.env.ADMIN_NOMBRE ?? "Administrador";
  const correo = process.env.ADMIN_CORREO ?? "admin@gestion.local";

  try {
    const existente = await db.query.usuarios.findFirst({ where: eq(schema.usuarios.rol, "ADMIN") });
    if (existente) {
      console.log(`✔ El administrador ya existe (identificación ${existente.identificacion}). No se modificó.`);
      return;
    }

    await db.insert(schema.usuarios).values({
      nombre,
      identificacion,
      correo,
      telefono: "0000000000",
      passwordHash: await bcrypt.hash(password, 12),
      rol: "ADMIN",
      estado: "ACTIVO",
    });
    console.log(`✔ Administrador creado con identificación ${identificacion}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✖ Error ejecutando el seed:", error);
  process.exit(1);
});
