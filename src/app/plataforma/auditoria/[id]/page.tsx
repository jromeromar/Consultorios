import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { AuditReport } from '@/components/audit/AuditReport'
import { getAssessment } from '@/lib/assessment/actions'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Auditoría vs. sector',
  robots: { index: false, follow: false },
}

export default async function AuditoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/plataforma/auditoria/${id}`)
  const assessment = await getAssessment(id)

  // Dueño por vínculo directo o por correo (assessment respondido antes de
  // registrarse). El staff de la agencia puede abrir cualquiera.
  const propio =
    assessment &&
    (assessment.userId === user.id ||
      assessment.leadEmail === user.email ||
      user.role === 'admin')
  if (!assessment || !propio) notFound()

  return (
    <>
      <Link href="/plataforma" className="text-[12px] text-[var(--color-accent)]">
        ← Mi plataforma
      </Link>
      <div className="mt-4">
        <AuditReport
          result={assessment.result}
          leadName={assessment.leadName}
          clinicName={assessment.clinicName}
          mode="full"
        />
      </div>
    </>
  )
}
