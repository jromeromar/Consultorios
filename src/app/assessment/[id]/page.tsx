import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { AuditReport } from '@/components/audit/AuditReport'
import { SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getAssessment } from '@/lib/assessment/actions'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Tu comparativa',
  robots: { index: false, follow: false },
}

/**
 * Vista previa del resultado, accesible con el enlace del assessment recién
 * enviado. El detalle por indicador vive detrás de la cuenta.
 */
export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, assessment] = await Promise.all([getSessionUser(), getAssessment(id)])
  if (!assessment) notFound()

  // Si es su dueño, no tiene sentido mostrarle la versión recortada.
  const esDueno = user && (assessment.userId === user.id || assessment.leadEmail === user.email)

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <AuditReport
          result={assessment.result}
          leadName={assessment.leadName}
          clinicName={assessment.clinicName}
          mode={esDueno ? 'full' : 'preview'}
          registerHref={`/registro?correo=${encodeURIComponent(assessment.leadEmail)}&especialidad=${assessment.specialtySlug}&segmento=${assessment.segmentSlug}&siguiente=${encodeURIComponent(`/plataforma/auditoria/${assessment.id}`)}`}
        />
      </main>
      <SiteFooter />
    </>
  )
}
