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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} ${geist.variable}`}
    >
      <body data-theme="light">{children}</body>
    </html>
  )
}
