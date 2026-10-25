import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ui } from '@/content/ui.ru';
import { MotionProvider } from '@/ui/MotionProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: ui.appName,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags -- стили шрифта генерируются по файлам в public/fonts */}
        <link rel="stylesheet" href="/fonts.css" />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
