CREATE TYPE "public"."estado_cuota" AS ENUM('PENDIENTE', 'PAGADA');--> statement-breakpoint
CREATE TYPE "public"."estado_factura" AS ENUM('PENDIENTE', 'COMPLETADA');--> statement-breakpoint
CREATE TYPE "public"."estado_usuario" AS ENUM('PENDIENTE', 'ACTIVO', 'PAUSADO');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('ADMIN', 'VENDEDOR');--> statement-breakpoint
CREATE TYPE "public"."tipo_factura" AS ENUM('NORMAL', 'CREDITO');--> statement-breakpoint
CREATE TABLE "abonos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"usuario_id" uuid,
	"valor" integer NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"identificacion" text NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"direccion" text NOT NULL,
	"sector" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha_vencimiento" timestamp with time zone NOT NULL,
	"valor" integer NOT NULL,
	"valor_pagado" integer DEFAULT 0 NOT NULL,
	"estado" "estado_cuota" DEFAULT 'PENDIENTE' NOT NULL,
	"pagada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "factura_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"producto_id" uuid,
	"nombre_producto" text NOT NULL,
	"precio_unitario" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"subtotal" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer NOT NULL,
	"tipo" "tipo_factura" NOT NULL,
	"estado" "estado_factura" NOT NULL,
	"local_id" uuid NOT NULL,
	"usuario_id" uuid,
	"vendedor_nombre" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"cliente_identificacion" text NOT NULL,
	"cliente_nombre" text NOT NULL,
	"cliente_telefono" text NOT NULL,
	"cliente_direccion" text NOT NULL,
	"cliente_sector" text NOT NULL,
	"subtotal" integer NOT NULL,
	"adicional" integer DEFAULT 0 NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"saldo" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"completada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"consecutivo_factura" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locales_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"nombre_busqueda" text NOT NULL,
	"codigo" text,
	"precio" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 3 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"identificacion" text NOT NULL,
	"correo" text NOT NULL,
	"telefono" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'VENDEDOR' NOT NULL,
	"estado" "estado_usuario" DEFAULT 'PENDIENTE' NOT NULL,
	"version_sesion" integer DEFAULT 0 NOT NULL,
	"local_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_identificacion_unique" UNIQUE("identificacion"),
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_factura_idx" ON "abonos" USING btree ("factura_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_local_ident_uq" ON "clientes" USING btree ("local_id","identificacion");--> statement-breakpoint
CREATE INDEX "cuotas_estado_fecha_idx" ON "cuotas" USING btree ("estado","fecha_vencimiento");--> statement-breakpoint
CREATE UNIQUE INDEX "facturas_local_numero_uq" ON "facturas" USING btree ("local_id","numero");--> statement-breakpoint
CREATE INDEX "facturas_local_fecha_idx" ON "facturas" USING btree ("local_id","creado_en");--> statement-breakpoint
CREATE INDEX "facturas_local_estado_idx" ON "facturas" USING btree ("local_id","estado");--> statement-breakpoint
CREATE INDEX "facturas_cliente_ident_idx" ON "facturas" USING btree ("cliente_identificacion");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_local_codigo_uq" ON "productos" USING btree ("local_id","codigo");--> statement-breakpoint
CREATE INDEX "productos_busqueda_idx" ON "productos" USING btree ("local_id","nombre_busqueda");--> statement-breakpoint
CREATE INDEX "usuarios_local_idx" ON "usuarios" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "usuarios_estado_idx" ON "usuarios" USING btree ("estado");