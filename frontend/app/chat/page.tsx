"use client";
import Markdown from "../../components/Markdown";
import { useI18n } from "../../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Image as ImageIcon } from "lucide-react";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [resp, setResp] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const { t, lang } = useI18n();

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const m = localStorage.getItem('km_chat_msg'); if (m) setMessage(m);
      const r = localStorage.getItem('km_chat_resp'); if (r) setResp(JSON.parse(r));
      const e = localStorage.getItem('km_chat_err'); if (e) setError(e);
      const s = localStorage.getItem('km_chat_sending'); if (s === '1') setSending(true);
    } catch {}
  }, []);
  // Persist changes
  useEffect(() => { try { localStorage.setItem('km_chat_msg', message || ''); } catch {} }, [message]);
  useEffect(() => { try { resp ? localStorage.setItem('km_chat_resp', JSON.stringify(resp)) : localStorage.removeItem('km_chat_resp'); } catch {} }, [resp]);
  useEffect(() => { try { error ? localStorage.setItem('km_chat_err', error) : localStorage.removeItem('km_chat_err'); } catch {} }, [error]);
  useEffect(() => { try { localStorage.setItem('km_chat_sending', sending ? '1' : '0'); } catch {} }, [sending]);

  useEffect(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = lang || 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) final += res[0].transcript;
        }
        if (final) setMessage((m) => (m ? m + ' ' : '') + final);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
    }
  }, [lang]);

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) { alert('Voice input not supported in this browser.'); return; }
    if (!listening) { try { rec.start(); setListening(true); } catch {} }
    else { try { rec.stop(); } catch {}; setListening(false); }
  };

  const onPickImage = () => {
    fileRef.current?.click();
  };

  const formatDiseaseMarkdown = (data: any) => {
    const parts: string[] = [];
    if (data.disease) parts.push(`**Disease:** ${data.disease}`);
    if (data.confidence) parts.push(`**Confidence:** ${data.confidence}`);
    if (data.description) parts.push(`\n${data.description}`);
    if (Array.isArray(data.management) && data.management.length) {
      parts.push(`\n**Management**`);
      parts.push(data.management.map((m: string) => `- ${m}`).join("\n"));
    }
    if (data.model) parts.push(`\n<sub>${t('labels.model')} ${data.model}</sub>`);
    return parts.join("\n");
  };

  const onFileChange = (e: any) => {
    const f = e.target.files?.[0] || null;
    setAttachedImage(f);
  };

  const send = async () => {
    setError(null);
    setResp(null);
    setSending(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      if (attachedImage) {
        const fd = new FormData();
        fd.append('image', attachedImage);
        fd.append('language', lang);
        const r = await fetch(`${base}/api/v1/disease/diagnose`, { method: 'POST', body: fd });
        const data = await r.json();
        if (!r.ok) {
          if (data?.fallback) {
            const md = formatDiseaseMarkdown(data.fallback);
            setResp({ model: data.fallback.model, reply: md });
          } else {
            throw new Error(data?.error || `HTTP ${r.status}`);
          }
        } else {
          const md = formatDiseaseMarkdown(data);
          setResp({ model: data.model, reply: md });
        }
        setAttachedImage(null);
        if (fileRef.current) fileRef.current.value = '';
      } else {
        try { localStorage.setItem('km_chat_sending', '1'); localStorage.setItem('km_chat_msg', message || ''); } catch {}
        const r = await fetch(`${base}/api/v1/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, language: lang }) });
        if (!r.ok) {
          const ttxt = await r.text();
          throw new Error(`HTTP ${r.status} ${ttxt}`);
        }
        const data = await r.json();
        setResp(data);
        try { localStorage.setItem('km_chat_resp', JSON.stringify(data)); } catch {}
      }
    } catch (e: any) {
      console.error('send failed', e);
      const errMsg = attachedImage ? t('errors.diagnose_failed') : t('errors.chat_failed');
      setError(errMsg);
      try { localStorage.setItem('km_chat_err', errMsg); } catch {}
    } finally {
      setSending(false);
      try { localStorage.setItem('km_chat_sending', '0'); } catch {}
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">{t('nav.chat')}</h1>
      <div className="card mt-6">
        <label>{t('chat.label')}</label>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('chat.placeholder')} />
        <div className="mt-3 flex gap-2 items-center">
          <button className="btn btn-secondary" onClick={toggleVoice} title={listening ? t('buttons.stop_voice') : t('buttons.start_voice')}>
            {listening ? <><MicOff className="inline-block w-4 h-4 mr-1" /> {t('buttons.stop_voice')}</> : <><Mic className="inline-block w-4 h-4 mr-1" /> {t('buttons.start_voice')}</>}
          </button>
          <button className="btn btn-secondary" onClick={onPickImage} title={t('buttons.attach_image')}>
            <ImageIcon className="inline-block w-4 h-4" />
            <span className="ml-1 text-sm">{t('labels.image')}</span>
          </button>
          {attachedImage && (
            <span className="text-xs text-white/70 truncate max-w-[40%]">{attachedImage.name}</span>
          )}
          <button className="btn btn-primary ml-auto" onClick={send} disabled={sending}>{sending ? t('busy.sending') : t('chat.send')}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        {error && <p className="text-amber-400 mt-3 text-sm">{error}</p>}
        {resp && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[color:var(--muted)] border border-[color:var(--border)]">{t('labels.model')} {resp.model}</span>
            </div>
            <div className="mt-2 border border-[color:var(--border)] rounded-lg p-3 bg-[color:var(--card)]">
              <Markdown content={resp.reply || JSON.stringify(resp)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
