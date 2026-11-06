CREATE TYPE "public"."medio_pago" AS ENUM('EFECTIVO', 'TRANSFERENCIA', 'MIXTO');--> statement-breakpoint
CREATE TYPE "public"."medio_pago_gasto" AS ENUM('EFECTIVO', 'TRANSFERENCIA');--> statement-breakpoint
CREATE TABLE "categorias_gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"categoria_id" uuid,
	"categoria_nombre" text NOT NULL,
	"descripcion" text,
	"valor" integer NOT NULL,
	"medio_pago" "medio_pago_gasto" NOT NULL,
	"fecha" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "medio_pago" "medio_pago" DEFAULT 'EFECTIVO' NOT NULL;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "valor_efectivo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "valor_transferencia" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "cliente_nombre_busqueda" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "medio_pago" "medio_pago";--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "valor_efectivo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "valor_transferencia" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categorias_gasto" ADD CONSTRAINT "categorias_gasto_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_gasto_local_nombre_uq" ON "categorias_gasto" USING btree ("local_id",lower("nombre"));--> statement-breakpoint
CREATE INDEX "gastos_local_fecha_idx" ON "gastos" USING btree ("local_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "sectores_local_nombre_uq" ON "sectores" USING btree ("local_id",lower("nombre"));--> statement-breakpoint
-- Datos existentes: las ventas de contado quedan como pagadas en efectivo.
-- Los créditos no tienen medio de pago propio: el dinero entra con cada abono.
UPDATE "facturas" SET "medio_pago" = 'EFECTIVO', "valor_efectivo" = "total" WHERE "tipo" = 'NORMAL';--> statement-breakpoint
-- Los abonos existentes quedan en efectivo (la columna medio_pago ya tiene ese valor por defecto).
UPDATE "abonos" SET "valor_efectivo" = "valor";--> statement-breakpoint
-- Los locales existentes reciben las mismas categorías de gastos que un local nuevo.
INSERT INTO "categorias_gasto" ("local_id", "nombre")
SELECT l."id", c."nombre"
FROM "locales" l
CROSS JOIN (VALUES ('Arriendo'), ('Servicios públicos'), ('Nómina'), ('Mercancía/proveedores'), ('Transporte'), ('Publicidad'), ('Otros')) AS c("nombre");
