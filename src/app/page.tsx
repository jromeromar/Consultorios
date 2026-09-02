import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Consultorios',
  description: 'Agencia para consultorios y clínicas de ortodoncia en Colombia.',
}

/**
 * Cascarón. El estudio y la auditoría son documentos estáticos generados por
 * `estudio/` (Python), no páginas de esta app: ver estudio/README.md.
 *
 * Esta app conserva únicamente el esquema del censo en `src/lib/db`, que puede
 * ser el destino del pipeline que produce los CSV que el generador consume.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24">
      <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-brand)]">
        Consultorios
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        Los estudios se publican como documentos estáticos. Este repositorio contiene el esquema
        del censo y el generador que produce el informe agregado y las auditorías individuales.
      </p>
    </main>
  )
}
