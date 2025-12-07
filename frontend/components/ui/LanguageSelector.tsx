"use client";

import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useI18n, LangCode } from '../../lib/i18n';

const LANGUAGES = [
  { code: 'en' as LangCode, name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'hi' as LangCode, name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'or' as LangCode, name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
];

export default function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLanguageSelect = (langCode: LangCode) => {
    setLang(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Language Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--border)] text-[color:var(--foreground)] transition-colors"
        aria-label={t('lang.select')}
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline text-sm font-medium">
          {currentLanguage.flag} {currentLanguage.nativeName}
        </span>
        <span className="sm:hidden text-sm">
          {currentLanguage.flag}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-[color:var(--border)]">
            <p className="text-xs font-medium text-[color:var(--foreground)]/70 uppercase tracking-wide">
              {t('lang.select')}
            </p>
          </div>
          
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language.code)}
              className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-left hover:bg-[color:var(--muted)] transition-colors ${
                lang === language.code 
                  ? 'text-[color:var(--primary)] bg-[color:var(--primary)]/10 font-medium' 
                  : 'text-[color:var(--foreground)]'
              }`}
            >
              <span className="text-base">{language.flag}</span>
              <div className="flex-1">
                <div className="font-medium">{language.nativeName}</div>
                <div className="text-xs text-[color:var(--foreground)]/60">{language.name}</div>
              </div>
              {lang === language.code && (
                <div className="w-2 h-2 bg-[color:var(--primary)] rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}