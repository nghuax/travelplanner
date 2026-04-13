import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vietnam Travel Planner',
  description: 'Plan your Vietnam road trip day by day with interactive maps and smart routing.',
  openGraph: {
    title: 'Vietnam Travel Planner',
    description: 'Plan your Vietnam adventure',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${cormorant.variable}`}>
      <body className="min-h-screen bg-olive-600 text-cream-200 antialiased">
        {children}
      </body>
    </html>
  );
}
