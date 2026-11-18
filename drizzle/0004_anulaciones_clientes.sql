ALTER TABLE "abonos" ADD COLUMN "anulado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "nombre_busqueda" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "nombre_compacto" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "telefono_digitos" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cuotas" ADD COLUMN "anulada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "anulada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "anulada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "anulada_por_id" uuid;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "anulada_por_nombre" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "anulado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "anulado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "anulado_por_nombre" text;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_anulada_por_id_usuarios_id_fk" FOREIGN KEY ("anulada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_anulado_por_id_usuarios_id_fk" FOREIGN KEY ("anulado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_local_nombre_busqueda_idx" ON "clientes" USING btree ("local_id","nombre_busqueda");--> statement-breakpoint
CREATE INDEX "clientes_local_telefono_idx" ON "clientes" USING btree ("local_id","telefono_digitos");--> statement-breakpoint
CREATE INDEX "facturas_local_anulada_idx" ON "facturas" USING btree ("local_id","anulada");--> statement-breakpoint
CREATE INDEX "facturas_cliente_idx" ON "facturas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "gastos_local_anulado_idx" ON "gastos" USING btree ("local_id","anulado");--> statement-breakpoint
-- ============================================================
--  Escrito a mano (no lo genera drizzle-kit)
-- ============================================================
-- 1. Backfill de las columnas de búsqueda de los clientes existentes.
--    Aproxima normalizarTexto() de src/lib/formato.ts: quita tildes y ñ, pasa a minúsculas
--    y cambia los signos por espacios. "npm run db:recalcular-busqueda" lo deja idéntico.
UPDATE "clientes" SET "nombre_busqueda" = btrim(regexp_replace(lower(translate("nombre",
    'áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z0-9]+', ' ', 'g'));--> statement-breakpoint
UPDATE "clientes" SET "nombre_compacto" = replace("nombre_busqueda", ' ', '');--> statement-breakpoint
-- Solo dígitos del teléfono; si son 12 y empiezan por 57 (indicativo de Colombia), se quita el 57.
UPDATE "clientes" SET "telefono_digitos" = CASE
    WHEN regexp_replace("telefono", '\D', '', 'g') ~ '^57\d{10}$' THEN substr(regexp_replace("telefono", '\D', '', 'g'), 3)
    ELSE regexp_replace("telefono", '\D', '', 'g') END;--> statement-breakpoint
-- 2. Extensión pg_trgm (búsqueda tolerante a errores de escritura).
--    Si el usuario de la base no tiene permiso para crearla, la migración NO falla:
--    la app sigue funcionando, solo sin la parte de "errores de escritura".
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No se pudo crear la extensión pg_trgm (%). La búsqueda por similitud quedará desactivada.', SQLERRM;
END $$;--> statement-breakpoint
-- 3. Índice GIN de similitud, solo si la extensión quedó instalada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS "clientes_nombre_trgm_idx" ON "clientes" USING gin ("nombre_busqueda" gin_trgm_ops);
  END IF;
END $$;
