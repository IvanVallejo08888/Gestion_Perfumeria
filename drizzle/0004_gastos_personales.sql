ALTER TABLE "categorias_gasto" ADD COLUMN "personal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "personal" boolean DEFAULT false NOT NULL;