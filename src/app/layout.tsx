import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono, Geist } from 'next/font/google'
import { contentSecurityPolicy } from '@/lib/csp'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display-loaded',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-loaded',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body-loaded',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Library Games',
    template: '%s — Library Games',
  },
  description: 'A collection of classic and modern games playable in your browser.',
  metadataBase: new URL('https://kkulykk.github.io/library-games'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Referenced literally so Next inlines them into the static export.
  const csp = contentSecurityPolicy({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} ${geist.variable}`}
    >
      <head>{csp && <meta httpEquiv="Content-Security-Policy" content={csp} />}</head>
      <body data-theme="light">{children}</body>
    </html>
  )
}
