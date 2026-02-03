import type { ReactNode } from 'react';

export const metadata = {
  title: 'Neon Starter',
  description: 'Next.js + TypeScript + Neon minimal setup.'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
