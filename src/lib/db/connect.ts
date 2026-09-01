import type { PgDatabase } from 'drizzle-orm/pg-core'
import { DEMO_MODE } from '../mode'
import * as schema from './schema'

export type Db = PgDatabase<never, typeof schema>

/**
 * Un solo esquema, tres modos:
 *
 *  - `DATABASE_URL` definido → Postgres real (Neon / Supabase / Vercel Postgres).
 *    Es el único modo apto para producción de verdad.
 *  - modo demostración (ver `src/lib/mode.ts`) → PGlite **en memoria**, migrado
 *    y sembrado en cada arranque en frío. Permite publicar una versión
 *    navegable sin base de datos, a costa de que las cuentas y los assessments
 *    vivan solo mientras la instancia esté caliente. La cabecera lo advierte.
 *  - ninguno de los dos → PGlite en `.data/pglite`, para desarrollo local.
 *
 * Devuelve también `close`, que los scripts de CLI necesitan y el servidor no usa.
 */
export async function connect(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.DATABASE_URL

  if (url) {
    const [{ drizzle }, postgres] = await Promise.all([
      import('drizzle-orm/postgres-js'),
      import('postgres'),
    ])
    const client = postgres.default(url, { max: 5, prepare: false })
    return {
      db: drizzle(client, { schema }) as unknown as Db,
      close: () => client.end(),
    }
  }

  const [{ drizzle }, { PGlite }] = await Promise.all([
    import('drizzle-orm/pglite'),
    import('@electric-sql/pglite'),
  ])
  const client = new PGlite(DEMO_MODE ? 'memory://' : (process.env.PGLITE_DIR ?? '.data/pglite'))
  const db = drizzle(client, { schema }) as unknown as Db

  if (DEMO_MODE) await prepararDemo(db)

  return { db, close: () => client.close() }
}

/**
 * Una base en memoria arranca vacía, así que hay que migrarla y sembrarla antes
 * de servir la primera petición. Las migraciones se leen de ./drizzle, que
 * `next.config.ts` incluye en el bundle serverless.
 */
async function prepararDemo(db: Db): Promise<void> {
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const { seedBenchmark, seedDemoUsers } = await import('./seed-core')

  await migrate(db as never, { migrationsFolder: './drizzle' })
  await seedBenchmark(db)
  await seedDemoUsers(db)
  console.log('Modo demostración: base en memoria migrada y sembrada.')
}

export { schema }
