import type { Metadata } from "next";
import "./globals.css";
import LayoutChrome from "../components/LayoutChrome";
import { LanguageProvider } from "../lib/i18n";

export const metadata: Metadata = {
  title: "AgriConnect",
  description: "Farmer-first marketplace and advisory"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <LanguageProvider>
          <LayoutChrome>
            {children}
          </LayoutChrome>
        </LanguageProvider>
      </body>
    </html>
  );
}
