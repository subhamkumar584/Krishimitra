"use client";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import Footer from "./Footer";
import ChatWidget from "./ChatWidget";

export default function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");
  return (
    <>
      {!isAuth && <NavBar />}
      <main className="flex-1">{children}</main>
      {!isAuth && <Footer />}
      {!isAuth && <ChatWidget />}
    </>
  );
}