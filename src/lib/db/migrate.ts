/**
 * Aplica las migraciones de ./drizzle al driver activo.
 *   npm run db:migrate
 */
import { loadEnvFiles } from '../load-env'

loadEnvFiles()

async function main() {
  const url = process.env.DATABASE_URL

  if (url) {
    const [{ drizzle }, { migrate }, postgres] = await Promise.all([
      import('drizzle-orm/postgres-js'),
      import('drizzle-orm/postgres-js/migrator'),
      import('postgres'),
    ])
    const client = postgres.default(url, { max: 1 })
    await migrate(drizzle(client), { migrationsFolder: './drizzle' })
    await client.end()
    console.log('Migraciones aplicadas en Postgres remoto.')
    return
  }

  const [{ drizzle }, { migrate }, { PGlite }] = await Promise.all([
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
    import('@electric-sql/pglite'),
  ])
  const dir = process.env.PGLITE_DIR ?? '.data/pglite'
  const client = new PGlite(dir)
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.close()
  console.log(`Migraciones aplicadas en PGlite (${dir}).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
