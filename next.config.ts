import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite trae un Postgres en WASM: tiene que quedar fuera del bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
}

export default nextConfig
