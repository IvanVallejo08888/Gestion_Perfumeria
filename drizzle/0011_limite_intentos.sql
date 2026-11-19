CREATE TABLE "limite_intentos" (
	"clave" text PRIMARY KEY NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL,
	"bloqueado_hasta" timestamp with time zone
);
