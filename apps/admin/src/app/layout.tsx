import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "@/shared/styles/globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";

const displayFont = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display",
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
    <html lang="en" className={displayFont.variable}>
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
