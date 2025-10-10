import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KrishiMitra",
  description: "Farmer-first marketplace and advisory"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
