"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export type ChatState = {
  message: string;
  reply: string | null;
  error: string | null;
  sending: boolean;
  model?: string;
};

type Listener = () => void;

class ChatServiceImpl {
  private state: ChatState = { message: "", reply: null, error: null, sending: false };
  private listeners: Set<Listener> = new Set();
  private storageKey = "km_chat_service_state";

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.state = { ...this.state, ...parsed };
        }
      } catch {}
    }
  }

  private emit() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch {}
    for (const l of Array.from(this.listeners)) l();
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  getSnapshot(): ChatState {
    return this.state;
  }

  setMessage(msg: string) {
    if (this.state.message === msg) return;
    this.state = { ...this.state, message: msg };
    this.emit();
  }

  resetError() {
    if (!this.state.error) return;
    this.state = { ...this.state, error: null };
    this.emit();
  }

  async send(baseUrl: string, lang: string) {
    const message = (this.state.message || "").trim();
    if (!message || this.state.sending) return;
    this.state = { ...this.state, sending: true, error: null, reply: null };
    this.emit();
    try {
      const r = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: lang })
      });
      if (!r.ok) {
        const tt = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${tt}`);
      }
      const data = await r.json().catch(() => null);
      const reply = (data && (data.reply || JSON.stringify(data))) || '';
      this.state = { ...this.state, sending: false, reply, model: data?.model };
      this.emit();
    } catch (e: any) {
      this.state = { ...this.state, sending: false, error: e?.message || 'Failed' };
      this.emit();
    }
  }
}

export const ChatService = new ChatServiceImpl();

export function useChatService() {
  const subscribe = (l: Listener) => ChatService.subscribe(l);
  const getSnapshot = () => ChatService.getSnapshot();
  const getServerSnapshot = () => ({ message: "", reply: null, error: null, sending: false });

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const baseRef = useRef<string>("");
  if (!baseRef.current) {
    baseRef.current = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000");
  }

  return {
    state,
    setMessage: (msg: string) => ChatService.setMessage(msg),
    resetError: () => ChatService.resetError(),
    send: (lang: string) => ChatService.send(baseRef.current, lang)
  };
}
