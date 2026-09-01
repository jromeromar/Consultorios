import { readFileSync } from 'node:fs'

/**
 * Carga .env.local y .env para los scripts de CLI (tsx no lo hace por sí solo,
 * y Next sí lo hace en dev/build). Sin dependencias: subconjunto KEY=VALUE.
 */
export function loadEnvFiles(files = ['.env.local', '.env']) {
  for (const file of files) {
    let raw: string
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i.exec(line)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue
      const value = rawValue.replace(/^(['"])(.*)\1$/s, '$2')
      if (value !== '') process.env[key] = value
    }
  }
}
