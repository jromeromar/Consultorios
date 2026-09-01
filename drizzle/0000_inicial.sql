CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"lead_email" text NOT NULL,
	"lead_name" text NOT NULL,
	"lead_phone" text,
	"clinic_name" text,
	"specialty_slug" text NOT NULL,
	"segment_slug" text NOT NULL,
	"period" text NOT NULL,
	"country" text DEFAULT 'MX' NOT NULL,
	"answers" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmark_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_slug" text NOT NULL,
	"specialty_slug" text NOT NULL,
	"segment_slug" text DEFAULT 'all' NOT NULL,
	"period" text NOT NULL,
	"country" text DEFAULT 'MX' NOT NULL,
	"sample_size" integer NOT NULL,
	"p10" numeric NOT NULL,
	"p25" numeric NOT NULL,
	"p50" numeric NOT NULL,
	"p75" numeric NOT NULL,
	"p90" numeric NOT NULL,
	"source_note" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"clinic_name" text,
	"specialty_slug" text NOT NULL,
	"segment_slug" text NOT NULL,
	"country" text DEFAULT 'MX' NOT NULL,
	"city" text,
	"phone" text,
	"role" text DEFAULT 'pro' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_user_idx" ON "assessments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assessments_email_idx" ON "assessments" USING btree ("lead_email");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmark_stats_key_unique" ON "benchmark_stats" USING btree ("kpi_slug","specialty_slug","segment_slug","period","country");--> statement-breakpoint
CREATE INDEX "benchmark_stats_lookup_idx" ON "benchmark_stats" USING btree ("specialty_slug","period");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");