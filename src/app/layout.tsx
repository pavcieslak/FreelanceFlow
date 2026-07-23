import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectFlow",
  description: "Time tracking and invoicing for solo freelancers",
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
