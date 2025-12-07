"use client";
import { useEffect, useState } from "react";
import { getAuth, clearAuth } from "../lib/auth";
import { useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n";

export default function AuthMenu() {
  const router = useRouter();
  const { t } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const a = getAuth();
    if (a) { setAuthed(true); setRole(a.user.role); } else { setAuthed(false); setRole(null); }
  }, []);

  const toDashboard = () => router.push('/dashboard');
  const logout = () => { clearAuth(); router.push('/auth/login'); };

  if (!authed) {
    return (
      <div className="flex items-center gap-3">
        <a href="/auth/login" className="btn btn-secondary">{t('auth.login')}</a>
        <a href="/auth/register" className="btn btn-primary">{t('auth.signup')}</a>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button className="btn btn-secondary" onClick={toDashboard}>{t('auth.dashboard')}{role ? ` (${role})` : ''}</button>
      <button className="btn btn-primary" onClick={logout}>{t('auth.logout')}</button>
    </div>
  );
}
