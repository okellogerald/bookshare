import type { Metadata } from "next";
import { Spline_Sans, Geist_Mono } from "next/font/google";
import "@/shared/styles/globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";

export const metadata: Metadata = {
  title: "BookShare Bookstores",
  description: "Bookstore workspace for BookShare organizations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
