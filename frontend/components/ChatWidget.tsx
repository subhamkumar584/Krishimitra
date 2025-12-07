"use client";
import { useState } from "react";
import Markdown from "./Markdown";
import { useI18n } from "../lib/i18n";
import { useEffect, useRef } from "react";
import { Mic, MicOff, Image as ImageIcon } from "lucide-react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const { t, lang } = useI18n();
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Restore persisted widget state
  useEffect(() => {
    try {
      const m = localStorage.getItem('km_widget_msg'); if (m) setMessage(m);
      const r = localStorage.getItem('km_widget_reply'); if (r) setReply(r);
      const b = localStorage.getItem('km_widget_busy'); if (b === '1') setBusy(true);
    } catch {}
  }, []);
  // Persist on change
  useEffect(() => { try { localStorage.setItem('km_widget_msg', message || ''); } catch {} }, [message]);
  useEffect(() => { try { reply ? localStorage.setItem('km_widget_reply', reply) : localStorage.removeItem('km_widget_reply'); } catch {} }, [reply]);
  useEffect(() => { try { localStorage.setItem('km_widget_busy', busy ? '1' : '0'); } catch {} }, [busy]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
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
    }
  }, [lang]);

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      alert('Voice input not supported in this browser.');
      return;
    }
    if (!listening) {
      try { rec.start(); setListening(true); } catch {}
    } else {
      try { rec.stop(); } catch {}
      setListening(false);
    }
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
    setBusy(true);
    setReply(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      if (attachedImage) {
        const fd = new FormData();
        fd.append('image', attachedImage);
        fd.append('language', lang);
        const r = await fetch(`${base}/api/v1/disease/diagnose`, { method: 'POST', body: fd });
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          if (data?.fallback) {
            setReply(formatDiseaseMarkdown(data.fallback));
          } else {
            throw new Error(data?.error || `HTTP ${r.status}`);
          }
        } else {
          setReply(formatDiseaseMarkdown(data));
        }
        setAttachedImage(null);
        if (fileRef.current) fileRef.current.value = '';
      } else {
        try { localStorage.setItem('km_widget_busy', '1'); localStorage.setItem('km_widget_msg', message || ''); } catch {}
        const r = await fetch(`${base}/api/v1/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, language: lang })
        });
        if (!r.ok) {
          const ttxt = await r.text().catch(() => '');
          throw new Error(ttxt || `HTTP ${r.status}`);
        }
        const data = await r.json().catch(() => null);
        const text = (data && (data.reply || JSON.stringify(data))) || '';
        setReply(text);
        try { localStorage.setItem('km_widget_reply', text); } catch {}
      }
    } catch (e) {
      setReply(attachedImage ? t('errors.diagnose_failed') : t('errors.chat_failed'));
      try { localStorage.setItem('km_widget_reply', attachedImage ? t('errors.diagnose_failed') : t('errors.chat_failed')); } catch {}
    } finally {
      setBusy(false);
      try { localStorage.setItem('km_widget_busy', '0'); } catch {}
    }
  };

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full btn btn-primary shadow-lg">
        AI
      </button>

      {/* Side panel */}
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1" onClick={() => setOpen(false)} />
          <div className="w-full sm:w-[380px] h-full bg-[color:var(--card)] border-l border-[color:var(--border)] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Chat with {t('nav.title')}</h3>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="mt-4">
              <label className="text-sm">{t('chat.label')}</label>
              <input className="mt-1" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('chat.placeholder')} />
              <div className="mt-3 flex gap-2 items-center">
                <button className="btn btn-secondary flex-1" onClick={toggleVoice} disabled={busy} title={listening ? t('buttons.stop_voice') : t('buttons.start_voice')}>
                  {listening ? <><MicOff className="inline-block w-4 h-4 mr-1" /> {t('buttons.stop_voice')}</> : <><Mic className="inline-block w-4 h-4 mr-1" /> {t('buttons.start_voice')}</>}
                </button>
                <button className="btn btn-secondary flex-1" onClick={onPickImage} title={t('buttons.attach_image')}>
                  <ImageIcon className="inline-block w-4 h-4" />
                  <span className="ml-1 text-sm">{t('labels.image')}</span>
                </button>
                {attachedImage && (
                  <span className="text-xs text-white/70 truncate max-w-[40%]">{attachedImage.name}</span>
                )}
                <button className="btn btn-primary flex-1" onClick={send} disabled={busy}>{busy ? t('busy.sending') : t('chat.send')}</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              {reply && (
                <div className="mt-3 border border-[color:var(--border)] rounded-lg p-3 bg-[color:var(--card)] max-h-72 overflow-auto">
                  <Markdown content={reply} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}