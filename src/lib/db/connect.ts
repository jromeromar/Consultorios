import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema-censo'

export type Db = PgDatabase<never, typeof schema>

/**
 * Un solo esquema, tres modos:
 *
 *  - `DATABASE_URL` definido → Postgres real (Neon / Supabase / Vercel Postgres).
 *    Es el único modo apto para producción de verdad.
 *  - ninguno → PGlite en `.data/pglite`, para desarrollo local.
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
  const db = drizzle(client, { schema }) as unknown as Db

  return { db, close: () => client.close() }
}

export { schema }
