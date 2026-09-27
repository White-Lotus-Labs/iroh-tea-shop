import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import '../ui/styles/tokens.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display-face',
  display: 'swap',
});
const body = Inter({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
});
// Decorative glyphs only; unicode-range slices mean the browser fetches just the few used characters.
const cjk = Noto_Serif_SC({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-cjk-face',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Tea After Pour — A quiet room for a finished thesis',
  description:
    'Bring your reasoning. Separate observation from inference in a warm, guided tea room. PASS A uses clearly labeled synthetic demo data.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${cjk.variable}`}
    >
      <head>
        <link rel="preload" as="image" href="/images/counter-wall.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
