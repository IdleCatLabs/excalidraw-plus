import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Excalidraw Plus - 智能白板与设计助手',
  description: '基于 Excalidraw 的新一代 AI 协作白板与原型设计工具',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased select-none">{children}</body>
    </html>
  );
}