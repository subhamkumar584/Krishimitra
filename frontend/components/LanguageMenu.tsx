"use client";
import { useI18n } from "../lib/i18n";

export default function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center">
      <select
        aria-label="Language"
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
        className="bg-[color:var(--card)] text-[color:var(--foreground)] border border-[color:var(--border)] rounded px-2 py-1 text-xs"
      >
        <option value="en">{t('lang.english')}</option>
        <option value="hi">{t('lang.hindi')}</option>
        <option value="or">{t('lang.odia')}</option>
      </select>
    </div>
  );
}
