import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Материзатор",
  description: "Языковая игра: перепишите фразу с помощью мата.",
};

export const viewport: Viewport = { themeColor: "#0b0b0f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
