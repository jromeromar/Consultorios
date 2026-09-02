import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema-censo.ts',
  out: './drizzle',
  dialect: 'postgresql',
} satisfies Config
