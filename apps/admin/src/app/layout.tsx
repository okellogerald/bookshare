import type { Metadata } from "next";
import "@/shared/styles/globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
