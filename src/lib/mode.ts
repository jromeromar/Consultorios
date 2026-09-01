/**
 * Modo de ejecución de la instancia.
 *
 * `DEMO_MODE` significa: Postgres en memoria, migrado y sembrado en cada
 * arranque en frío, sin persistencia. Se activa de dos formas:
 *
 *  - explícitamente con `DEMO_MODE=1`, o
 *  - por descarte, en un despliegue en Vercel sin `DATABASE_URL` — donde la
 *    alternativa sería estrellarse, porque PGlite necesita disco de escritura y
 *    en serverless no lo hay.
 *
 * Fuera de Vercel no se infiere nada: `next start` en local sigue usando el
 * PGlite de `.data/pglite`, que es lo que se espera al probar un build.
 *
 * Lo que nunca ocurre: que un despliegue **con** base de datos caiga en modo
 * demostración. La presencia de `DATABASE_URL` lo descarta siempre, así que una
 * instalación real no puede convertirse en demo por accidente. Y cuando el modo
 * está activo, la cabecera lo anuncia en todas las páginas.
 */
export const HAS_DATABASE = Boolean(process.env.DATABASE_URL)

const EN_VERCEL = process.env.VERCEL === '1'

export const DEMO_MODE = !HAS_DATABASE && (process.env.DEMO_MODE === '1' || EN_VERCEL)
