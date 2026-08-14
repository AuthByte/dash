import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { DISCLAIMER, getSiteUrl } from "@/lib/site";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Picks Tracker — Multi-profile Dashboard",
  description: `Live trackers for stock picks across multiple analysts and traders. ${DISCLAIMER}`,
  openGraph: {
    title: "Picks Tracker — Multi-profile Dashboard",
    description: `Live trackers for stock picks across multiple analysts and traders. ${DISCLAIMER}`,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-[var(--color-bg)] font-sans text-[var(--color-text)] antialiased">
        {children}
      </body>
    </html>
  );
}
