import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Mafia for Cousins — In-Room Social Deduction',
  description:
    'A real-time multiplayer social deduction game designed for mobile browsers. Gather your cousins, join a room, and find the imposters!',
  keywords: ['mafia', 'game', 'multiplayer', 'social deduction', 'imposter', 'mobile'],
  authors: [{ name: 'Mafia for Cousins' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,    // prevent zoom — keeps game layout stable
  userScalable: false,
  themeColor: '#080810',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-bg-primary text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
