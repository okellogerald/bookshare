import type { Metadata } from "next";
import { Spline_Sans, Geist_Mono } from "next/font/google";
import "@/shared/styles/globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-spline-sans",
  fallback: ["Avenir", "ui-sans-serif", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "BookShare Admin",
  description: "Internal staff console for BookShare",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${splineSans.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
