import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<never, typeof schema>

/**
 * Un solo esquema, dos drivers:
 *  - DATABASE_URL definido  -> Postgres real (Neon / Supabase / Vercel Postgres).
 *  - DATABASE_URL vacío     -> PGlite embebido en .data/pglite, para desarrollo
 *    sin infraestructura. Mismo dialecto, mismas consultas.
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
  const client = new PGlite(process.env.PGLITE_DIR ?? '.data/pglite')
  return {
    db: drizzle(client, { schema }) as unknown as Db,
    close: () => client.close(),
  }
}

export { schema }
