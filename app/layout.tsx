import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0f11',
};
export const metadata: Metadata = {
  title: 'Ритм — суфлёр, который слушает',
  description:
    'Онлайн-суфлёр с прокруткой вслед за речью. Редактируйте текст, говорите в своём темпе и держите нужную строку в центре.',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Ритм', statusBarStyle: 'black' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  );
}
