import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'dump.lol — the breakup text you couldn\'t write',
  description: 'Three questions. AI writes the breakup text. You decide if it sends.',
  openGraph: {
    title: 'dump.lol',
    description: 'AI wrote my breakup text and honestly it\'s better than anything I would\'ve said.',
    url: 'https://dump-dot-lol.vercel.app',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
