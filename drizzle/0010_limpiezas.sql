CREATE TYPE "public"."alcance_limpieza" AS ENUM('PERIODO', 'VENTAS', 'CREDITOS', 'GASTOS', 'CLIENTES', 'INVENTARIO', 'TODO');--> statement-breakpoint
CREATE TABLE "limpiezas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid,
	"local_nombre" text NOT NULL,
	"admin_id" uuid,
	"admin_nombre" text NOT NULL,
	"alcance" "alcance_limpieza" NOT NULL,
	"anio" integer,
	"meses" integer[],
	"conteos" jsonb NOT NULL,
	"valor_total" bigint DEFAULT 0 NOT NULL,
	"reinicio_consecutivo" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "limpiezas" ADD CONSTRAINT "limpiezas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limpiezas" ADD CONSTRAINT "limpiezas_admin_id_usuarios_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limpiezas_local_fecha_idx" ON "limpiezas" USING btree ("local_id","creado_en");