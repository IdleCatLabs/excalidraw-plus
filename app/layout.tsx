import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="h-screen w-screen">{children}</body>
    </html>
  );
}
