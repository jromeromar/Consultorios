import 'server-only'

import { connect, schema, type Db } from './connect'

type Cache = { db?: Promise<Db> }
const cache = globalThis as unknown as { __consultoriosDb?: Cache }
cache.__consultoriosDb ??= {}

/** Cliente único por proceso; sobrevive los recargos en caliente de `next dev`. */
export function getDb(): Promise<Db> {
  cache.__consultoriosDb!.db ??= connect().then(({ db }) => db)
  return cache.__consultoriosDb!.db
}

export type { Db }
export { schema }
