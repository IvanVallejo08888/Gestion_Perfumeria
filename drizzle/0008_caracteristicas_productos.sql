CREATE TYPE "public"."categoria_producto" AS ENUM('PERFUME', 'ESTUCHE', 'BODY_MIST', 'CREMA', 'DESODORANTE', 'DECANT', 'ACCESORIO', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."concentracion" AS ENUM('EXTRAIT', 'PARFUM', 'EDP', 'EDT', 'EDC', 'BODY_MIST', 'SPLASH', 'OTRO');--> statement-breakpoint
ALTER TYPE "public"."genero" ADD VALUE 'UNISEX';--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "contenido_ml" integer;--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "concentracion" "concentracion";--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "categoria" "categoria_producto";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "variante" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "concentracion" "concentracion";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "contenido_ml" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "categoria" "categoria_producto";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "nombre_completo" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- ============================================================
--  Escrito a mano (no lo genera drizzle-kit): backfill de los datos existentes
-- ============================================================
-- 1. El tamaño en onzas pasa a mililitros (los mismos ml que mostraba la etiqueta del tamaño).
--    Se hace en productos y en la copia guardada en cada venta (factura_items).
UPDATE "productos" SET "contenido_ml" = CASE "tamano"
    WHEN 'OZ_2' THEN 60 WHEN 'OZ_2_5' THEN 75 WHEN 'OZ_3_4' THEN 100 WHEN 'OZ_4' THEN 120 WHEN 'OZ_4_2' THEN 125 END
  WHERE "tamano" IS NOT NULL;--> statement-breakpoint
UPDATE "factura_items" SET "contenido_ml" = CASE "tamano"
    WHEN 'OZ_2' THEN 60 WHEN 'OZ_2_5' THEN 75 WHEN 'OZ_3_4' THEN 100 WHEN 'OZ_4' THEN 120 WHEN 'OZ_4_2' THEN 125 END
  WHERE "tamano" IS NOT NULL;--> statement-breakpoint
-- 2. Los productos ya clasificados (con tipo) son perfumes.
UPDATE "productos" SET "categoria" = 'PERFUME' WHERE "tipo" IS NOT NULL;--> statement-breakpoint
-- 3. Nombre completo provisional = el nombre actual (la app nunca muestra un nombre vacío).
--    "npm run db:recalcular-busqueda" lo arma con armarNombreProducto() ("Marca Nombre · 100 ml · Hombre").
UPDATE "productos" SET "nombre_completo" = "nombre" WHERE "nombre_completo" = '';
