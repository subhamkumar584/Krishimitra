"use client";
import { useI18n } from "../lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-[color:var(--border)] mt-10">
      <div className="container py-8 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} {t('nav.title')}. All rights reserved.</p>
        <nav className="flex gap-4">
          <a className="hover:text-white" href="/advisory">{t('nav.advisory')}</a>
          <a className="hover:text-white" href="/marketplace">{t('nav.marketplace')}</a>
          <a className="hover:text-white" href="/chat">{t('nav.chat')}</a>
        </nav>
      </div>
    </footer>
  );
}
