import { SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { requireUser } from '@/lib/auth/session'

/**
 * Guardia de la plataforma. Todo lo que cuelga de /plataforma se renderiza en el
 * servidor, así que esta comprobación es la autoritativa: sin sesión no se llega
 * a ejecutar ninguna página hija.
 */
export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <>
      <SiteHeader user={user} />
      <div className="mx-auto max-w-6xl px-5 py-10">{children}</div>
      <SiteFooter />
    </>
  )
}
