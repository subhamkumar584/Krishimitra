"use client";
import dynamic from "next/dynamic";
import { useI18n } from "../lib/i18n";
import { useEffect, useState } from "react";
import { getAuth } from "../lib/auth";
const AuthMenu = dynamic(() => import("./AuthMenu"), { ssr: false });
const LanguageMenu = dynamic(() => import("./LanguageMenu"), { ssr: false });

export default function NavBar() {
  const { t } = useI18n();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const a = getAuth();
    setRole(a?.user?.role || null);
  }, []);
  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--card)]/60 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--card)]/40">
      <div className="container py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="inline-block w-2 h-6 bg-[color:var(--primary)] rounded-sm" />
          {t('nav.title')}
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          {(role === 'customer' || role === 'equipmetal') ? (
            <a className="hover:text-white" href="/marketplace">{t('nav.marketplace')}</a>
          ) : (
            <>
              <a className="hover:text-white" href="/dashboard">{t('nav.home')}</a>
              <a className="hover:text-white" href="/marketplace">{t('nav.marketplace')}</a>
              <a className="hover:text-white" href="/advisory">{t('nav.advisory')}</a>
              <a className="hover:text-white" href="/chat">{t('nav.chat')}</a>
              <a className="hover:text-white" href="/tracker">{t('nav.tracker')}</a>
              <a className="hover:text-white" href="/disease">{t('nav.disease')}</a>
              {/* Admin-only: User Approval */}
              {role === 'admin' && (
                <a className="hover:text-white" href="/admin/user-approvals">User Approval</a>
              )}
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          {/* Auth-aware menu */}
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
