import type { Config } from 'drizzle-kit'

export default {
  // Dos esquemas en la misma base: las tablas propias de la plataforma y las
  // 22 del censo. Comparten conexión y migraciones.
  schema: ['./src/lib/db/schema.ts', './src/lib/db/schema-censo.ts'],
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config
