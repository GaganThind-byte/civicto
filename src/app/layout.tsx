import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Civicto | Community operations',
  description: 'Resident services and maintenance workflows for community teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
