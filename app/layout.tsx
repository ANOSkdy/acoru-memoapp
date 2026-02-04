import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Acoru Memo',
  description: 'Memo app scaffolded for Vercel deploys.'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
