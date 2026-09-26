import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});
const jbm = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jbm",
});
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "ФАЙЕРПРОМ Metalworks — единый портал расчётов",
  description:
    "Инженерный расчёт гибки и развёрток, коммерческие предложения, DXF и единая история — в одном портале.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} ${jbm.variable} ${unbounded.variable} bg-bg font-sans text-white antialiased`}
      >
        <div className="app-bg" />
        <SiteHeader />
        <main className="app-shell relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
