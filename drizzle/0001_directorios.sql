CREATE TYPE "public"."base_observacion" AS ENUM('pagina_publica', 'api_autorizada', 'acuerdo_escrito');--> statement-breakpoint
CREATE TYPE "public"."estado_perfil_directorio" AS ENUM('ok', 'sin_perfil', 'bloqueado', 'timeout', 'error');--> statement-breakpoint
CREATE TABLE "directorio" (
	"directorio_id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"dominio" text NOT NULL,
	"publica_calificacion" boolean NOT NULL,
	"publica_orden" boolean NOT NULL,
	"base_observacion" "base_observacion" NOT NULL,
	"fecha_revision_terminos" date NOT NULL,
	"nota_terminos" text
);
--> statement-breakpoint
CREATE TABLE "directorio_perfil_snapshot" (
	"perfil_snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"directorio_id" text NOT NULL,
	"fecha_captura" date NOT NULL,
	"estado_perfil" "estado_perfil_directorio" NOT NULL,
	"existe" boolean,
	"url_perfil" text,
	"esta_reclamado" boolean,
	"esta_verificado" boolean,
	"calificacion" numeric,
	"resenas_total" integer,
	"fecha_resena_mas_reciente" date,
	"tiene_foto" boolean,
	"tiene_horario" boolean,
	"tiene_precio" boolean,
	"servicios_n" integer,
	"nombre_perfil_crudo" text,
	"metodo_emparejamiento" "metodo_emparejamiento" NOT NULL,
	"confianza_emparejamiento" numeric
);
--> statement-breakpoint
CREATE TABLE "directorio_ranking" (
	"ranking_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"directorio_id" text NOT NULL,
	"consulta_texto" text NOT NULL,
	"consulta_normalizada" text NOT NULL,
	"municipio_id" varchar(5) NOT NULL,
	"fecha_consulta" date NOT NULL,
	"dispositivo" "dispositivo" NOT NULL,
	"posicion" integer NOT NULL,
	"resultados_total" integer NOT NULL,
	"nombre_resultado_crudo" text,
	"consultorio_id" uuid,
	"metodo_emparejamiento" "metodo_emparejamiento" NOT NULL,
	"confianza_emparejamiento" numeric
);
--> statement-breakpoint
ALTER TABLE "directorio_perfil_snapshot" ADD CONSTRAINT "directorio_perfil_snapshot_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directorio_perfil_snapshot" ADD CONSTRAINT "directorio_perfil_snapshot_directorio_id_directorio_directorio_id_fk" FOREIGN KEY ("directorio_id") REFERENCES "public"."directorio"("directorio_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directorio_ranking" ADD CONSTRAINT "directorio_ranking_directorio_id_directorio_directorio_id_fk" FOREIGN KEY ("directorio_id") REFERENCES "public"."directorio"("directorio_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directorio_ranking" ADD CONSTRAINT "directorio_ranking_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "directorio_perfil_clave_unica" ON "directorio_perfil_snapshot" USING btree ("consultorio_id","directorio_id","fecha_captura");--> statement-breakpoint
CREATE INDEX "directorio_perfil_directorio_idx" ON "directorio_perfil_snapshot" USING btree ("directorio_id","fecha_captura");--> statement-breakpoint
CREATE UNIQUE INDEX "directorio_ranking_clave_unica" ON "directorio_ranking" USING btree ("directorio_id","consulta_normalizada","municipio_id","fecha_consulta","dispositivo","posicion");--> statement-breakpoint
CREATE INDEX "directorio_ranking_consultorio_idx" ON "directorio_ranking" USING btree ("consultorio_id","fecha_consulta");