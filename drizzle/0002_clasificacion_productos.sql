CREATE TYPE "public"."genero" AS ENUM('HOMBRE', 'MUJER');--> statement-breakpoint
CREATE TYPE "public"."publico" AS ENUM('ADULTO', 'INFANTIL');--> statement-breakpoint
CREATE TYPE "public"."tamano_producto" AS ENUM('OZ_2', 'OZ_2_5', 'OZ_3_4', 'OZ_4', 'OZ_4_2');--> statement-breakpoint
CREATE TYPE "public"."tipo_producto" AS ENUM('ORIGINAL', 'UNO_UNO', 'IMITACION', 'VERSION', 'ESENCIA');--> statement-breakpoint
CREATE TABLE "marcas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "marca_nombre" text;--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "tipo" "tipo_producto";--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "genero" "genero";--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "publico" "publico";--> statement-breakpoint
ALTER TABLE "factura_items" ADD COLUMN "tamano" "tamano_producto";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "marca_id" uuid;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "tipo" "tipo_producto";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "genero" "genero";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "publico" "publico";--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "tamano" "tamano_producto";--> statement-breakpoint
ALTER TABLE "marcas" ADD CONSTRAINT "marcas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marcas_local_nombre_uq" ON "marcas" USING btree ("local_id",lower("nombre"));--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_marca_idx" ON "productos" USING btree ("marca_id");