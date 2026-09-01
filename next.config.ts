import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite trae un Postgres en WASM: tiene que quedar fuera del bundle.
  serverExternalPackages: ['@electric-sql/pglite'],

  // El modo demostración migra una base en memoria al arrancar, así que los
  // .sql de las migraciones tienen que viajar con la función serverless.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**'],
  },
}

export default nextConfig
