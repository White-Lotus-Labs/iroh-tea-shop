import type { Metadata } from 'next';
import './globals.css';
import '../ui/styles/tokens.css';
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
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/images/counter-wall.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
