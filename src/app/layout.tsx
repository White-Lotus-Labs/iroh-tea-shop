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
  preload: true,
});
const body = Inter({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
  preload: true,
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
  title: "Iroh's Tea Shop — Explore Crypto Theses with Nansen",
  description:
    "A 3D tea shop built on live Nansen data. Check three crypto theses against smart-money activity, see the top Hyperliquid traders, and ask Uncle, a host backed by Nansen's Research Agent.",
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
      <body>{children}</body>
    </html>
  );
}
