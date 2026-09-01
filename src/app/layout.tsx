import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Consultorios · Estudios de Benchmark',
    template: '%s · Consultorios',
  },
  description:
    'Benchmark comercial para ortodoncistas, médicos, odontólogos estéticos y medicina estética: compara tu consultorio contra el sector.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
