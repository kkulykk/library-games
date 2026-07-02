import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono, Geist } from 'next/font/google'
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

// P2-6: a defense-in-depth Content-Security-Policy. GitHub Pages cannot set
// response headers, so this ships as a <meta> tag baked into the static export.
// It is deliberately only emitted in production builds — `next dev` relies on
// eval + a localhost websocket for HMR that a strict policy would break. Static
// export cannot mint per-request nonces, so script/style fall back to
// 'unsafe-inline' (Next hydration + Tailwind); the meaningful win is locking
// connect-src down to self + the Supabase origin so the localStorage-held room
// tokens can only be sent back to Supabase.
function contentSecurityPolicy(): string | null {
  if (process.env.NODE_ENV !== 'production') return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseHttp = ''
  let supabaseWs = ''
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin
      supabaseHttp = origin
      supabaseWs = origin.replace(/^http/, 'ws')
    } catch {
      // ignore a malformed URL — connect-src just stays 'self'
    }
  }
  const connectSrc = ["'self'", supabaseHttp, supabaseWs].filter(Boolean).join(' ')

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    `connect-src ${connectSrc}`,
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const csp = contentSecurityPolicy()
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
