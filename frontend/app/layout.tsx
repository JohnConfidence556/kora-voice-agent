import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Unbounded } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

// Unbounded: a wide display face for headlines and money. Instrument Sans: everything else.
const display = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: mobile self-service with an AI assistant`, template: `%s | ${BRAND.name}` },
  description:
    "An independent portfolio project: a telecom self-service account with a chat assistant and a voice assistant. Balances and payments are simulated.",
};

export const viewport: Viewport = { themeColor: "#2338F5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
