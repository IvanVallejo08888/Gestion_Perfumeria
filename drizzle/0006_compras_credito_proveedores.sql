CREATE TYPE "public"."estado_cuenta_pagar" AS ENUM('PENDIENTE', 'SALDADA');--> statement-breakpoint
CREATE TYPE "public"."medio_pago_compra" AS ENUM('EFECTIVO', 'TRANSFERENCIA', 'CREDITO');--> statement-breakpoint
CREATE TABLE "abonos_proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	"medio_pago" "medio_pago" NOT NULL,
	"valor_efectivo" integer DEFAULT 0 NOT NULL,
	"valor_transferencia" integer DEFAULT 0 NOT NULL,
	"fecha" date NOT NULL,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras_mercancia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"proveedor_nombre" text NOT NULL,
	"producto_id" uuid,
	"producto_nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"total" integer NOT NULL,
	"medio_pago" "medio_pago_compra" NOT NULL,
	"saldo" integer DEFAULT 0 NOT NULL,
	"estado" "estado_cuenta_pagar" NOT NULL,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"saldada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "abonos_proveedor" ADD CONSTRAINT "abonos_proveedor_compra_id_compras_mercancia_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras_mercancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos_proveedor" ADD CONSTRAINT "abonos_proveedor_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_mercancia" ADD CONSTRAINT "compras_mercancia_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_mercancia" ADD CONSTRAINT "compras_mercancia_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_mercancia" ADD CONSTRAINT "compras_mercancia_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_mercancia" ADD CONSTRAINT "compras_mercancia_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_proveedor_compra_idx" ON "abonos_proveedor" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX "compras_local_proveedor_idx" ON "compras_mercancia" USING btree ("local_id","proveedor_id");--> statement-breakpoint
CREATE INDEX "compras_local_estado_idx" ON "compras_mercancia" USING btree ("local_id","estado");