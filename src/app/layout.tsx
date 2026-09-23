import type { Metadata } from 'next';
import './globals.css';
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
      <body>{children}</body>
    </html>
  );
}
