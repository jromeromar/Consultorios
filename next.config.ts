import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres; it must stay outside the server bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
}

export default nextConfig
