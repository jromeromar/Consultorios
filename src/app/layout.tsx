import type { Metadata } from 'next'
import { IBM_Plex_Mono, Instrument_Sans, Newsreader } from 'next/font/google'

import { MARCA, META } from '@/contenido/landing'
import './globals.css'

/**
 * Las tres tipografías se autoalojan: la higiene técnica mínima que el copy pide
 * incluye carga rápida en móvil, y una petición a un tercero no ayuda a eso.
 */
const estructura = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fuente-estructura',
  display: 'swap',
})

const prosa = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--fuente-prosa',
  display: 'swap',
})

const dato = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-dato',
  display: 'swap',
})

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  // Higiene mínima: indexable, para que el nombre de la marca aparezca cuando
  // alguien lo busque después del congreso. Nada más.
  robots: { index: true, follow: true },
  openGraph: {
    title: META.title,
    description: META.description,
    type: 'website',
    locale: 'es_CO',
    siteName: MARCA.nombre,
  },
}

/**
 * Schema `Organization`. Sin `AggregateRating`: no hay reseñas propias y
 * simularlas sería exactamente lo que la página dice no hacer.
 */
const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: MARCA.nombre,
  description: META.description,
  address: { '@type': 'PostalAddress', addressCountry: META.pais },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${estructura.variable} ${prosa.variable} ${dato.variable}`}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
        />
      </body>
    </html>
  )
}
