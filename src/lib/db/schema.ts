import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Usuarios de la plataforma. Un usuario = un profesional o clínica.
 * `role` separa al profesional del staff de la agencia (que ve todo el panel).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    clinicName: text('clinic_name'),
    specialtySlug: text('specialty_slug').notNull(),
    segmentSlug: text('segment_slug').notNull(),
    country: text('country').notNull().default('MX'),
    city: text('city'),
    phone: text('phone'),
    role: text('role').notNull().default('pro'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
)

/**
 * Distribución del sector para un KPI, recortada por especialidad, segmento y periodo.
 * Guardamos percentiles (no filas individuales) porque es lo que la auditoría
 * necesita y evita almacenar datos identificables de terceros.
 */
export const benchmarkStats = pgTable(
  'benchmark_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kpiSlug: text('kpi_slug').notNull(),
    specialtySlug: text('specialty_slug').notNull(),
    segmentSlug: text('segment_slug').notNull().default('all'),
    period: text('period').notNull(),
    country: text('country').notNull().default('MX'),
    sampleSize: integer('sample_size').notNull(),
    p10: numeric('p10').notNull(),
    p25: numeric('p25').notNull(),
    p50: numeric('p50').notNull(),
    p75: numeric('p75').notNull(),
    p90: numeric('p90').notNull(),
    sourceNote: text('source_note').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('benchmark_stats_key_unique').on(
      t.kpiSlug,
      t.specialtySlug,
      t.segmentSlug,
      t.period,
      t.country,
    ),
    index('benchmark_stats_lookup_idx').on(t.specialtySlug, t.period),
  ],
)

/**
 * Un assessment respondido. Nace anónimo (lead-gen) y se reclama al registrarse:
 * `userId` se rellena cuando el lead crea su cuenta con el mismo correo.
 */
export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    leadEmail: text('lead_email').notNull(),
    leadName: text('lead_name').notNull(),
    leadPhone: text('lead_phone'),
    clinicName: text('clinic_name'),
    specialtySlug: text('specialty_slug').notNull(),
    segmentSlug: text('segment_slug').notNull(),
    period: text('period').notNull(),
    country: text('country').notNull().default('MX'),
    /** Respuestas crudas: { [questionId]: number | string | null } */
    answers: jsonb('answers').notNull(),
    /** Resultado calculado por src/lib/benchmark/scoring.ts */
    result: jsonb('result').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('assessments_user_idx').on(t.userId),
    index('assessments_email_idx').on(t.leadEmail),
  ],
)
