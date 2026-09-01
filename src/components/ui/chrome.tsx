import Link from 'next/link'

import { salir } from '@/lib/auth/actions'
import type { SessionUser } from '@/lib/auth/session'
import { DEMO_MODE } from '@/lib/mode'

export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-[var(--color-hair)] bg-[var(--color-surface)]">
      <DemoModeBanner />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-[var(--color-brand)]">
          Consultorios
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-[var(--color-ink-2)]">
          <Link href="/estudios" className="hover:text-[var(--color-accent)]">
            Estudios
          </Link>
          <Link href="/assessment" className="hover:text-[var(--color-accent)]">
            Assessment
          </Link>
          {user ? (
            <Link href="/plataforma" className="hover:text-[var(--color-accent)]">
              Mi plataforma
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          {user ? (
            <>
              <span className="hidden text-[var(--color-muted)] sm:inline">{user.email}</span>
              <form action={salir}>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--color-hair)] px-3 py-1.5 text-[var(--color-ink-2)] hover:border-[var(--color-axis)]"
                >
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/entrar" className="text-[var(--color-ink-2)] hover:text-[var(--color-accent)]">
                Entrar
              </Link>
              <Link
                href="/assessment"
                className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 font-medium text-white hover:bg-[var(--color-accent)]"
              >
                Hacer el assessment
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Barra del modo demostración. La base vive en memoria, así que las cuentas y
 * los assessments desaparecen cuando la instancia se enfría: decirlo por
 * adelantado evita que parezca un fallo.
 */
function DemoModeBanner() {
  if (!DEMO_MODE) return null

  return (
    <div className="border-b border-[var(--color-hair)] bg-[var(--color-brand)] px-5 py-2 text-center text-[12px] leading-relaxed text-white">
      <strong className="font-semibold">Versión de demostración.</strong> Corre sobre una base en
      memoria: las cuentas y los resultados que crees aquí se borran solos. Cuenta lista para
      probar: <span className="tabular">demo@consultorios.co</span> /{' '}
      <span className="tabular">consultorios123</span>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--color-hair)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-5 py-8 text-[12px] leading-relaxed text-[var(--color-muted)]">
        <p className="max-w-2xl">
          Consultorios · Plataforma de estudios de benchmark para consultorios y clínicas. Las
          cifras del periodo de demostración son sintéticas y están marcadas como tales en cada
          vista.
        </p>
      </div>
    </footer>
  )
}

/** Aviso permanente de que el periodo cargado no es una muestra de campo. */
export function DemoDataNotice({ sampleSize }: { sampleSize?: number }) {
  return (
    <p className="rounded-md border border-[var(--color-hair)] bg-[var(--color-surface-2)] px-3 py-2 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
      <strong className="font-semibold">Periodo de demostración.</strong> Las distribuciones
      cargadas son sintéticas: sirven para operar la plataforma completa antes de la primera
      muestra de campo, no como resultado de un estudio.
      {sampleSize ? ` (n = ${sampleSize} simulado)` : null}
    </p>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--color-hair)] bg-[var(--color-surface)] ${className}`}
    >
      {children}
    </section>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: string
  lead?: string
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
      {lead ? <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">{lead}</p> : null}
    </div>
  )
}
