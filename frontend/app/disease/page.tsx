"use client";
import { useState } from "react";
import Markdown from "../../components/Markdown";
import { useI18n } from "../../lib/i18n";

export default function DiseasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { t, lang } = useI18n();

  const submit = async () => {
    setError(null); setResult(null); setBusy(true);
    try {
      if (!file) { setError(t('errors.select_image')); setBusy(false); return; }
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const fd = new FormData();
      fd.append("image", file);
      if (crop) fd.append("crop", crop);
      fd.append("language", lang);
      const res = await fetch(`${base}/api/v1/disease/diagnose`, { method: 'POST', body: fd });
      const ct = res.headers.get('content-type') || '';
      let data: any = null;
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        if (!res.ok && res.status === 413) {
          throw new Error('Image too large. Try a smaller image.');
        }
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (!res.ok) {
        if (data?.fallback) { setResult(data.fallback); return; }
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message || t('errors.diagnose_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">{t('nav.disease')}</h1>
      <p className="text-white/70">{t('disease.subtitle')}</p>

      <div className="card mt-6 max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label>{t('labels.plant_image')}</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label>{t('labels.crop_optional')}</label>
            <input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="e.g., tomato" />
          </div>
        </div>
        <button className="btn btn-primary mt-4" disabled={busy} onClick={submit}>{busy ? t('busy.analyzing') : t('buttons.diagnose')}</button>
        {error && <p className="text-amber-400 text-sm mt-3">{error}</p>}
      </div>

      {result && (
        <div className="grid mt-6 gap-4 max-w-2xl">
          <div className="card">
            <h2 className="text-xl font-semibold">{t('result.title')}</h2>
            <ul className="list-disc list-inside text-white/80 text-sm mt-2">
              {result.disease && <li><strong>{t('labels.disease')}</strong> {result.disease}</li>}
              {result.confidence && <li><strong>{t('labels.confidence')}</strong> {result.confidence}</li>}
            </ul>
            {result.description && (
              <div className="mt-3 border border-[color:var(--border)] rounded-lg p-3">
                <Markdown content={result.description} />
              </div>
            )}
            {Array.isArray(result.management) && result.management.length > 0 && (
              <div className="mt-3">
                <h3 className="text-lg font-semibold">{t('labels.management')}</h3>
                <ul className="list-disc list-inside text-white/80 text-sm mt-2">
                  {result.management.map((m: string, i: number) => (<li key={i}>{m}</li>))}
                </ul>
              </div>
            )}
            {result.model && <p className="text-white/50 text-xs mt-3">{t('labels.model')} {result.model}</p>}
          </div>
        </div>
      )}
    </div>
  );
}