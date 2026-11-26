CREATE TYPE "public"."estado_deuda" AS ENUM('PENDIENTE', 'PAGADA', 'ANULADA');--> statement-breakpoint
ALTER TYPE "public"."alcance_limpieza" ADD VALUE 'DEUDAS';--> statement-breakpoint
ALTER TYPE "public"."medio_pago_gasto" ADD VALUE 'CREDITO';--> statement-breakpoint
CREATE TABLE "deuda_cuotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deuda_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"fecha_vencimiento" timestamp with time zone NOT NULL,
	"valor" integer NOT NULL,
	"valor_pagado" integer DEFAULT 0 NOT NULL,
	"estado" "estado_cuota" DEFAULT 'PENDIENTE' NOT NULL,
	"pagada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deuda_pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deuda_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"valor" integer NOT NULL,
	"medio_pago" "medio_pago" NOT NULL,
	"valor_efectivo" integer DEFAULT 0 NOT NULL,
	"valor_transferencia" integer DEFAULT 0 NOT NULL,
	"nota" text,
	"usuario_id" uuid,
	"usuario_nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado" boolean DEFAULT false NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por_id" uuid,
	"anulado_por_nombre" text,
	"motivo_anulacion" text
);
--> statement-breakpoint
CREATE TABLE "deudas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"gasto_id" uuid NOT NULL,
	"acreedor" text NOT NULL,
	"descripcion" text,
	"valor_total" integer NOT NULL,
	"saldo" integer NOT NULL,
	"estado" "estado_deuda" DEFAULT 'PENDIENTE' NOT NULL,
	"pagada_en" timestamp with time zone,
	"resumen_medio_pago" "medio_pago",
	"creado_por_id" uuid,
	"creado_por_nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulada_en" timestamp with time zone,
	"anulada_por_id" uuid,
	"anulada_por_nombre" text,
	"motivo_anulacion" text
);
--> statement-breakpoint
ALTER TABLE "deuda_cuotas" ADD CONSTRAINT "deuda_cuotas_deuda_id_deudas_id_fk" FOREIGN KEY ("deuda_id") REFERENCES "public"."deudas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deuda_pagos" ADD CONSTRAINT "deuda_pagos_deuda_id_deudas_id_fk" FOREIGN KEY ("deuda_id") REFERENCES "public"."deudas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deuda_pagos" ADD CONSTRAINT "deuda_pagos_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deuda_pagos" ADD CONSTRAINT "deuda_pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deuda_pagos" ADD CONSTRAINT "deuda_pagos_anulado_por_id_usuarios_id_fk" FOREIGN KEY ("anulado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_gasto_id_gastos_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_anulada_por_id_usuarios_id_fk" FOREIGN KEY ("anulada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deuda_cuotas_deuda_idx" ON "deuda_cuotas" USING btree ("deuda_id");--> statement-breakpoint
CREATE INDEX "deuda_cuotas_estado_fecha_idx" ON "deuda_cuotas" USING btree ("estado","fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "deuda_pagos_deuda_idx" ON "deuda_pagos" USING btree ("deuda_id");--> statement-breakpoint
CREATE INDEX "deuda_pagos_local_fecha_idx" ON "deuda_pagos" USING btree ("local_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "deudas_gasto_uq" ON "deudas" USING btree ("gasto_id");--> statement-breakpoint
CREATE INDEX "deudas_local_estado_idx" ON "deudas" USING btree ("local_id","estado");