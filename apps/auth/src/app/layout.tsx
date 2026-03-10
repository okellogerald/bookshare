import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookShare Auth",
  description: "Authentication portal powered by Kratos and Hydra",
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
