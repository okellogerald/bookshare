import type { Metadata } from "next";
import "@/shared/styles/globals.css";
import { QueryProvider } from "@/shared/providers/query-provider";

export const metadata: Metadata = {
  title: "BookShare",
  description: "A private community book-sharing directory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
