CREATE TYPE "public"."ambito_tipo" AS ENUM('pais', 'departamento', 'municipio', 'localidad', 'territorio');--> statement-breakpoint
CREATE TYPE "public"."base_legal" AS ENUM('fuente_publica', 'consentimiento');--> statement-breakpoint
CREATE TYPE "public"."bloque_puntaje" AS ENUM('visibilidad', 'reputacion', 'contenido', 'respuesta', 'reservabilidad');--> statement-breakpoint
CREATE TYPE "public"."bloque_serp" AS ENUM('paquete_local', 'organico', 'anuncio');--> statement-breakpoint
CREATE TYPE "public"."campo_declarado" AS ENUM('precio_lista', 'cobra_primera_cita', 'valor_primera_cita', 'consultas_mes', 'anos_ejercicio', 'sillas', 'persona_dedicada_mensajes', 'software_gestion');--> statement-breakpoint
CREATE TYPE "public"."canal_campo" AS ENUM('whatsapp', 'instagram_dm', 'formulario_web');--> statement-breakpoint
CREATE TYPE "public"."caso_mostrado" AS ENUM('no', 'territorio_1', 'territorio_2');--> statement-breakpoint
CREATE TYPE "public"."categoria_ciudad" AS ENUM('capital_principal', 'capital_departamental', 'intermedia', 'otra');--> statement-breakpoint
CREATE TYPE "public"."confianza" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TYPE "public"."conjunto_consultas" AS ENUM('nucleo', 'ampliado');--> statement-breakpoint
CREATE TYPE "public"."declarado_si_no" AS ENUM('si', 'no', 'no_dice');--> statement-breakpoint
CREATE TYPE "public"."destino_enlace" AS ENUM('reserva', 'whatsapp', 'sitio', 'agregador', 'ninguno');--> statement-breakpoint
CREATE TYPE "public"."dio_precio" AS ENUM('no', 'rango', 'exacto', 'no_observado');--> statement-breakpoint
CREATE TYPE "public"."direccion_indicador" AS ENUM('mas_es_mejor', 'menos_es_mejor');--> statement-breakpoint
CREATE TYPE "public"."dispositivo" AS ENUM('movil', 'escritorio');--> statement-breakpoint
CREATE TYPE "public"."estado_envio" AS ENUM('entregado', 'no_entregado', 'bloqueado', 'numero_invalido');--> statement-breakpoint
CREATE TYPE "public"."estado_rastreo" AS ENUM('ok', 'sin_sitio', 'error_dns', 'timeout', 'bloqueado');--> statement-breakpoint
CREATE TYPE "public"."estado_registro" AS ENUM('activo', 'cerrado', 'duplicado', 'fuera_de_alcance');--> statement-breakpoint
CREATE TYPE "public"."estado_territorio" AS ENUM('libre', 'reservado', 'asignado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."evento_conversacion" AS ENUM('congreso', 'entrevista', 'referido');--> statement-breakpoint
CREATE TYPE "public"."evento_declarado" AS ENUM('chat_campo', 'entrevista', 'stand_congreso', 'formulario_web');--> statement-breakpoint
CREATE TYPE "public"."franja_horaria" AS ENUM('madrugada', 'manana', 'mediodia', 'tarde', 'noche');--> statement-breakpoint
CREATE TYPE "public"."fuente_captura" AS ENUM('maps', 'serp', 'manual');--> statement-breakpoint
CREATE TYPE "public"."fuente_geo" AS ENUM('dane_proyeccion', 'dane_censo', 'reps', 'rues', 'distrital', 'otra');--> statement-breakpoint
CREATE TYPE "public"."fuente_listado" AS ENUM('google_maps', 'directorio', 'asociacion', 'manual');--> statement-breakpoint
CREATE TYPE "public"."herramienta_keywords" AS ENUM('ubersuggest', 'keyword_planner', 'otra');--> statement-breakpoint
CREATE TYPE "public"."indicador_geo" AS ENUM('poblacion', 'prestadores_odontologia', 'prestadores_ortodoncia', 'otro');--> statement-breakpoint
CREATE TYPE "public"."metodo_emparejamiento" AS ENUM('place_id', 'telefono', 'dominio', 'nombre_aproximado', 'sin_emparejar');--> statement-breakpoint
CREATE TYPE "public"."observado" AS ENUM('si', 'no', 'no_observado');--> statement-breakpoint
CREATE TYPE "public"."pasarela" AS ENUM('wompi', 'mercadopago', 'payu', 'otra', 'ninguna');--> statement-breakpoint
CREATE TYPE "public"."peldano" AS ENUM('nada', 'carta', 'anticipo');--> statement-breakpoint
CREATE TYPE "public"."plataforma_agenda" AS ENUM('dentalink', 'agendapro', 'doctoralia', 'calendly', 'otro', 'ninguno');--> statement-breakpoint
CREATE TYPE "public"."rol_declarante" AS ENUM('profesional', 'recepcion', 'desconocido');--> statement-breakpoint
CREATE TYPE "public"."tipo_establecimiento" AS ENUM('consultorio_individual', 'clinica_multisilla', 'cadena', 'franquicia');--> statement-breakpoint
CREATE TYPE "public"."tipo_intencion" AS ENUM('precio', 'servicio', 'marca', 'informativa');--> statement-breakpoint
CREATE TYPE "public"."tipo_respondedor" AS ENUM('persona', 'automatico', 'indeterminado');--> statement-breakpoint
CREATE TYPE "public"."tipo_territorio" AS ENUM('municipio', 'conjunto_de_municipios', 'localidad', 'conjunto_de_localidades');--> statement-breakpoint
CREATE TYPE "public"."tipo_unidad" AS ENUM('municipio', 'localidad');--> statement-breakpoint
CREATE TYPE "public"."ventana_keywords" AS ENUM('12m', '3m', 'ultimo_mes');--> statement-breakpoint
CREATE TYPE "public"."vertical" AS ENUM('ortodoncia', 'odontologia_estetica', 'medicina_estetica', 'otra');--> statement-breakpoint
CREATE TABLE "consulta" (
	"consulta_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consulta_texto" text NOT NULL,
	"consulta_normalizada" text NOT NULL,
	"vertical" "vertical" NOT NULL,
	"tipo_intencion" "tipo_intencion" NOT NULL,
	"lleva_calificador_geografico" boolean NOT NULL,
	"conjunto" "conjunto_consultas" NOT NULL,
	"vigente_desde" date NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultorio" (
	"consultorio_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cid" text,
	"place_id" text,
	"place_id_verificado_fecha" date,
	"google_id" text,
	"kgmid" text,
	"es_ortodoncia" boolean,
	"tipo_establecimiento" "tipo_establecimiento",
	"estado_registro" "estado_registro" DEFAULT 'activo' NOT NULL,
	"consultorio_id_maestro" uuid,
	"motivo_duplicado" text,
	"fuente_listado" "fuente_listado",
	"en_muestra_estudio" boolean DEFAULT false NOT NULL,
	"estrato_muestra" text,
	"fecha_alta" date,
	"fecha_ultima_captura" date
);
--> statement-breakpoint
CREATE TABLE "consultorio_contacto" (
	"contacto_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"nombre_completo" text,
	"cargo" text,
	"email" text,
	"email_estado_validacion" text,
	"telefono_contacto_e164" text,
	"perfil_linkedin" text,
	"perfil_instagram" text,
	"base_legal" "base_legal",
	"fecha_captura" date,
	"fecha_solicitud_supresion" date
);
--> statement-breakpoint
CREATE TABLE "consultorio_snapshot" (
	"snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"fecha_captura" date NOT NULL,
	"fuente_captura" "fuente_captura" NOT NULL,
	"nombre_comercial" text,
	"nombre_normalizado" text,
	"categoria_principal" text,
	"subtipos" text,
	"esta_cerrado_permanente" boolean,
	"direccion" text,
	"codigo_postal" text,
	"latitud" numeric,
	"longitud" numeric,
	"h3" text,
	"plus_code" text,
	"municipio_id" varchar(5),
	"centro_poblado_id" varchar(8),
	"localidad_id" text,
	"telefono_e164" text,
	"telefono_original" text,
	"dominio" text,
	"sitio_web_url" text,
	"instagram_handle" text,
	"facebook_url" text,
	"es_area_de_servicio" boolean,
	"calificacion" numeric,
	"resenas_total" integer,
	"fecha_resena_mas_reciente" date,
	"resenas_respondidas_pct" numeric,
	"tiene_horario_publicado" boolean,
	"fotos_n" integer
);
--> statement-breakpoint
CREATE TABLE "contacto_campo" (
	"contacto_campo_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"edicion_id" uuid NOT NULL,
	"guion_id" uuid,
	"canal" "canal_campo" NOT NULL,
	"destino_usado" text,
	"emisor_id" text,
	"enviado_en" timestamp with time zone,
	"dia_semana" integer,
	"franja_horaria" "franja_horaria",
	"estado_envio" "estado_envio",
	"primera_respuesta_en" timestamp with time zone,
	"minutos_primera_respuesta" integer,
	"hubo_respuesta" boolean,
	"tipo_primer_respondedor" "tipo_respondedor",
	"ofrecio_agendar" "observado",
	"dio_precio" "dio_precio",
	"precio_min_mencionado" bigint,
	"precio_max_mencionado" bigint,
	"menciono_cobro_primera_cita" "observado",
	"valor_primera_cita" bigint,
	"abona_al_tratamiento" "declarado_si_no",
	"pidio_datos_del_paciente" "observado",
	"hubo_seguimiento_espontaneo" "observado",
	"minutos_hasta_seguimiento" integer,
	"codificado_por" text,
	"codificado_en" date,
	"version_codificacion" text,
	"excluido_del_analisis" boolean DEFAULT false NOT NULL,
	"motivo_exclusion" text
);
--> statement-breakpoint
CREATE TABLE "conversacion_calificada" (
	"conversacion_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid,
	"fecha" date NOT NULL,
	"evento" "evento_conversacion" NOT NULL,
	"municipio_id" varchar(5),
	"anos_ejercicio" integer,
	"consultas_mes_declaradas" integer,
	"persona_dedicada_mensajes" boolean,
	"software_gestion" text,
	"es_calificada" boolean,
	"caso_mostrado" "caso_mostrado",
	"peldano_alcanzado" "peldano",
	"objecion_fee" text,
	"objecion_credibilidad" text,
	"reconstruccion_del_nombre" text
);
--> statement-breakpoint
CREATE TABLE "dato_declarado" (
	"declarado_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"evento" "evento_declarado" NOT NULL,
	"campo" "campo_declarado" NOT NULL,
	"valor_texto" text,
	"valor_numero" numeric,
	"valor_booleano" boolean,
	"rol_de_quien_declara" "rol_declarante",
	"confianza" "confianza"
);
--> statement-breakpoint
CREATE TABLE "edicion_estudio" (
	"edicion_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"campo_inicio" date,
	"campo_fin" date,
	"corte_reloj_horas" integer,
	"n_universo" integer,
	"n_muestra" integer,
	"n_respondio" integer,
	"municipios_incluidos" text,
	"version_formula" text,
	"publicada_en" date,
	"notas_metodo" text
);
--> statement-breakpoint
CREATE TABLE "formula_puntaje" (
	"version" text NOT NULL,
	"bloque" "bloque_puntaje" NOT NULL,
	"indicador" text NOT NULL,
	"peso" numeric NOT NULL,
	"transformacion" text NOT NULL,
	"direccion" "direccion_indicador" NOT NULL,
	"vigente_desde" date NOT NULL,
	CONSTRAINT "formula_puntaje_version_indicador_pk" PRIMARY KEY("version","indicador")
);
--> statement-breakpoint
CREATE TABLE "guion" (
	"guion_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"canal" "canal_campo" NOT NULL,
	"texto" text NOT NULL,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date
);
--> statement-breakpoint
CREATE TABLE "indicador_geografico" (
	"indicador_geo_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambito_tipo" "ambito_tipo" NOT NULL,
	"ambito_id" text NOT NULL,
	"indicador" "indicador_geo" NOT NULL,
	"periodo" text NOT NULL,
	"valor" numeric NOT NULL,
	"unidad" text NOT NULL,
	"fuente" "fuente_geo" NOT NULL,
	"version_serie" text,
	"fecha_captura" date NOT NULL,
	"nota" text
);
--> statement-breakpoint
CREATE TABLE "instagram_snapshot" (
	"ig_snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid,
	"handle" text NOT NULL,
	"fecha_captura" date NOT NULL,
	"seguidores" integer,
	"publicaciones_total" integer,
	"publicaciones_30d" integer,
	"interaccion_promedio_pct" numeric,
	"ultima_publicacion_fecha" date,
	"tiene_enlace_en_bio" boolean,
	"destino_enlace" "destino_enlace",
	"es_cuenta_profesional" boolean,
	"publica_antes_despues" boolean
);
--> statement-breakpoint
CREATE TABLE "localidad" (
	"localidad_id" text PRIMARY KEY NOT NULL,
	"municipio_id" varchar(5) NOT NULL,
	"nombre_localidad" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensaje_campo" (
	"mensaje_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contacto_campo_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"direccion" text NOT NULL,
	"enviado_en" timestamp with time zone,
	"texto" text,
	"parece_automatico" boolean
);
--> statement-breakpoint
CREATE TABLE "municipio" (
	"municipio_id" varchar(5) PRIMARY KEY NOT NULL,
	"nombre_municipio" text NOT NULL,
	"departamento" text NOT NULL,
	"departamento_id" varchar(2) NOT NULL,
	"categoria_ciudad" "categoria_ciudad" NOT NULL,
	"area_metropolitana" text,
	"es_cabecera_de_area" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puntaje" (
	"consultorio_id" uuid NOT NULL,
	"edicion_id" uuid NOT NULL,
	"puntaje_visibilidad" numeric,
	"puntaje_reputacion" numeric,
	"puntaje_contenido" numeric,
	"puntaje_respuesta" numeric,
	"puntaje_reservabilidad" numeric,
	"puntaje_general" numeric,
	"percentil_general" integer,
	"percentil_visibilidad" numeric,
	"percentil_reputacion" numeric,
	"percentil_contenido" numeric,
	"percentil_respuesta" numeric,
	"percentil_reservabilidad" numeric,
	"percentil_grupo_ciudad" integer,
	"bloques_no_medidos" text,
	"version_formula" text,
	"calculado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "puntaje_consultorio_id_edicion_id_pk" PRIMARY KEY("consultorio_id","edicion_id")
);
--> statement-breakpoint
CREATE TABLE "resena" (
	"resena_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"fecha_publicacion" date,
	"calificacion" integer,
	"tiene_respuesta_del_negocio" boolean,
	"dias_hasta_respuesta" integer,
	"fecha_captura" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serp_local" (
	"serp_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consulta_texto" text NOT NULL,
	"consulta_normalizada" text NOT NULL,
	"municipio_id" varchar(5) NOT NULL,
	"fecha_consulta" date NOT NULL,
	"dispositivo" "dispositivo" NOT NULL,
	"bloque" "bloque_serp" NOT NULL,
	"posicion" integer NOT NULL,
	"nombre_resultado_crudo" text,
	"consultorio_id" uuid,
	"metodo_emparejamiento" "metodo_emparejamiento" NOT NULL,
	"confianza_emparejamiento" numeric
);
--> statement-breakpoint
CREATE TABLE "sitio_snapshot" (
	"sitio_snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultorio_id" uuid NOT NULL,
	"dominio" text,
	"fecha_rastreo" date NOT NULL,
	"estado_rastreo" "estado_rastreo" NOT NULL,
	"website_title" text,
	"website_description" text,
	"website_generator" text,
	"tiene_gtm" boolean,
	"tiene_pixel_meta" boolean,
	"plataforma_agenda_detectada" "plataforma_agenda",
	"tiene_reserva_online" boolean,
	"tiene_pago_en_linea" boolean,
	"pasarela_detectada" "pasarela",
	"es_movil_responsive" boolean,
	"puntaje_velocidad_movil" integer
);
--> statement-breakpoint
CREATE TABLE "territorio" (
	"territorio_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre_territorio" text NOT NULL,
	"tipo" "tipo_territorio" NOT NULL,
	"poblacion_total" integer,
	"poblacion_periodo" text,
	"poblacion_fuente" text,
	"volumen_busqueda_mes" integer,
	"volumen_conjunto" "conjunto_consultas",
	"volumen_fecha_captura" date,
	"pasa_umbral_poblacional" boolean,
	"estado" "estado_territorio" DEFAULT 'libre' NOT NULL,
	"consultorio_id_asignado" uuid,
	"fecha_reserva" date,
	"fecha_vencimiento_reserva" date
);
--> statement-breakpoint
CREATE TABLE "territorio_unidad" (
	"territorio_id" uuid NOT NULL,
	"tipo_unidad" "tipo_unidad" NOT NULL,
	"unidad_id" text NOT NULL,
	"nota" text,
	CONSTRAINT "territorio_unidad_territorio_id_tipo_unidad_unidad_id_pk" PRIMARY KEY("territorio_id","tipo_unidad","unidad_id")
);
--> statement-breakpoint
CREATE TABLE "volumen_busqueda" (
	"volumen_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consulta_id" uuid NOT NULL,
	"ambito_tipo" "ambito_tipo" NOT NULL,
	"ambito_id" text,
	"fecha_captura" date NOT NULL,
	"herramienta" "herramienta_keywords" NOT NULL,
	"loc_id" text,
	"ventana" "ventana_keywords",
	"volumen_mes" integer,
	"cpc_estimado" bigint,
	"competencia_pagada" numeric,
	"dificultad_seo" integer,
	"nota" text
);
--> statement-breakpoint
ALTER TABLE "consultorio_contacto" ADD CONSTRAINT "consultorio_contacto_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultorio_snapshot" ADD CONSTRAINT "consultorio_snapshot_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacto_campo" ADD CONSTRAINT "contacto_campo_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacto_campo" ADD CONSTRAINT "contacto_campo_guion_id_guion_guion_id_fk" FOREIGN KEY ("guion_id") REFERENCES "public"."guion"("guion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversacion_calificada" ADD CONSTRAINT "conversacion_calificada_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dato_declarado" ADD CONSTRAINT "dato_declarado_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_snapshot" ADD CONSTRAINT "instagram_snapshot_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "localidad" ADD CONSTRAINT "localidad_municipio_id_municipio_municipio_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipio"("municipio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje_campo" ADD CONSTRAINT "mensaje_campo_contacto_campo_id_contacto_campo_contacto_campo_id_fk" FOREIGN KEY ("contacto_campo_id") REFERENCES "public"."contacto_campo"("contacto_campo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puntaje" ADD CONSTRAINT "puntaje_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puntaje" ADD CONSTRAINT "puntaje_edicion_id_edicion_estudio_edicion_id_fk" FOREIGN KEY ("edicion_id") REFERENCES "public"."edicion_estudio"("edicion_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resena" ADD CONSTRAINT "resena_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_local" ADD CONSTRAINT "serp_local_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitio_snapshot" ADD CONSTRAINT "sitio_snapshot_consultorio_id_consultorio_consultorio_id_fk" FOREIGN KEY ("consultorio_id") REFERENCES "public"."consultorio"("consultorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territorio_unidad" ADD CONSTRAINT "territorio_unidad_territorio_id_territorio_territorio_id_fk" FOREIGN KEY ("territorio_id") REFERENCES "public"."territorio"("territorio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volumen_busqueda" ADD CONSTRAINT "volumen_busqueda_consulta_id_consulta_consulta_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consulta"("consulta_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consulta_normalizada_unica" ON "consulta" USING btree ("consulta_normalizada");--> statement-breakpoint
CREATE UNIQUE INDEX "consultorio_cid_unico" ON "consultorio" USING btree ("cid");--> statement-breakpoint
CREATE INDEX "consultorio_place_id_idx" ON "consultorio" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "consultorio_universo_idx" ON "consultorio" USING btree ("es_ortodoncia","estado_registro");--> statement-breakpoint
CREATE UNIQUE INDEX "consultorio_snapshot_clave_unica" ON "consultorio_snapshot" USING btree ("consultorio_id","fecha_captura");--> statement-breakpoint
CREATE INDEX "consultorio_snapshot_municipio_idx" ON "consultorio_snapshot" USING btree ("municipio_id","fecha_captura");--> statement-breakpoint
CREATE INDEX "consultorio_snapshot_telefono_idx" ON "consultorio_snapshot" USING btree ("telefono_e164");--> statement-breakpoint
CREATE INDEX "consultorio_snapshot_dominio_idx" ON "consultorio_snapshot" USING btree ("dominio");--> statement-breakpoint
CREATE UNIQUE INDEX "contacto_campo_clave_unica" ON "contacto_campo" USING btree ("consultorio_id","edicion_id","canal");--> statement-breakpoint
CREATE INDEX "contacto_campo_edicion_idx" ON "contacto_campo" USING btree ("edicion_id");--> statement-breakpoint
CREATE INDEX "dato_declarado_consultorio_idx" ON "dato_declarado" USING btree ("consultorio_id","campo","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "indicador_geografico_clave_unica" ON "indicador_geografico" USING btree ("ambito_tipo","ambito_id","indicador","periodo","fuente","version_serie");--> statement-breakpoint
CREATE INDEX "indicador_geografico_ambito_idx" ON "indicador_geografico" USING btree ("ambito_tipo","ambito_id","indicador");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_snapshot_clave_unica" ON "instagram_snapshot" USING btree ("handle","fecha_captura");--> statement-breakpoint
CREATE UNIQUE INDEX "mensaje_campo_orden_unico" ON "mensaje_campo" USING btree ("contacto_campo_id","orden");--> statement-breakpoint
CREATE INDEX "puntaje_edicion_idx" ON "puntaje" USING btree ("edicion_id");--> statement-breakpoint
CREATE INDEX "resena_consultorio_idx" ON "resena" USING btree ("consultorio_id","fecha_publicacion");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_local_clave_unica" ON "serp_local" USING btree ("consulta_normalizada","municipio_id","fecha_consulta","dispositivo","bloque","posicion");--> statement-breakpoint
CREATE INDEX "serp_local_consultorio_idx" ON "serp_local" USING btree ("consultorio_id","fecha_consulta");--> statement-breakpoint
CREATE UNIQUE INDEX "sitio_snapshot_clave_unica" ON "sitio_snapshot" USING btree ("consultorio_id","fecha_rastreo");--> statement-breakpoint
CREATE UNIQUE INDEX "territorio_unidad_exclusividad" ON "territorio_unidad" USING btree ("tipo_unidad","unidad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "volumen_busqueda_clave_unica" ON "volumen_busqueda" USING btree ("consulta_id","ambito_tipo","ambito_id","fecha_captura","herramienta");--> statement-breakpoint
CREATE INDEX "volumen_busqueda_ambito_idx" ON "volumen_busqueda" USING btree ("ambito_tipo","ambito_id");