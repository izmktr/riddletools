import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Riddle Tools",
  description: "謎解きに役立つツール集",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
