import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Configuración de Drizzle Kit (migraciones).
 * - schema: dónde están definidas las tablas.
 * - out: carpeta donde se guardan los archivos SQL de migración.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
