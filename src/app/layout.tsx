import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Library Games',
  description: 'A collection of classic and modern games playable in your browser.',
  metadataBase: new URL('https://kkulykk.github.io/library-games'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  )
}
