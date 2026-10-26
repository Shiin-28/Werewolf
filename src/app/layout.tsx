import type { Metadata, Viewport } from "next";
import { Oswald, Shippori_Mincho } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const mincho = Shippori_Mincho({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mincho",
  preload: false, // CJK font: let the browser fetch only the glyph ranges it needs
});

export const metadata: Metadata = {
  title: "Werewolf",
  description: "Game Master companion for face-to-face Werewolf",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070506",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${mincho.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
