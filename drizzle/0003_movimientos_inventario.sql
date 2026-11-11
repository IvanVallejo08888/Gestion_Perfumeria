CREATE TYPE "public"."tipo_movimiento" AS ENUM('INGRESO', 'VENTA', 'AJUSTE');--> statement-breakpoint
CREATE TABLE "movimientos_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"cantidad" integer NOT NULL,
	"stock_resultante" integer NOT NULL,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"factura_id" uuid,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_producto_fecha_idx" ON "movimientos_inventario" USING btree ("producto_id","creado_en");--> statement-breakpoint
CREATE INDEX "movimientos_local_fecha_idx" ON "movimientos_inventario" USING btree ("local_id","creado_en");