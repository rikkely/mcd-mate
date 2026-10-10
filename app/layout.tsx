import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "McD Mate｜麦门宇宙",
  description: "把预算、心情和用餐场景变成一场麦门寻宝局。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
