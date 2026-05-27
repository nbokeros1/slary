import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Lora, Fira_Code } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['300', '400', '500', '700', '800'],
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
  style: ['normal', 'italic'],
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira',
  display: 'swap',
  weight: ['300', '400'],
})

export const metadata: Metadata = {
  title: 'Slary — Paie & Impôts · CA & USA',
  description: 'Calcule ton salaire net en 10 secondes. Suivi fiscal CA & USA. Taux réels 2026 par province et état.',
  applicationName: 'Slary',
  keywords: ['salaire net', 'calculateur paie', 'impôts Canada', 'tax USA', 'freelance', 'gig economy'],
  authors: [{ name: 'Slary' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Slary',
    startupImage: '/icon-512.png',
  },
  icons: {
    apple: '/icon-192.png',
    icon: '/icon-512.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,          // empêche le zoom accidentel sur iOS
  userScalable: false,
  themeColor: '#0F1117',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${lora.variable} ${firaCode.variable}`}
    >
      <body className="min-h-screen bg-[#0F1117] text-[#E8E6E0]">
        {children}
      </body>
    </html>
  )
}
