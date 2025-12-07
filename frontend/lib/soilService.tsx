"use client";

import { useRef, useSyncExternalStore } from "react";

export type SoilState = {
  soil_type: string;
  ph: number;
  season: string;
  loading: boolean;
  result: any | null;
  error: string | null;
};

type Listener = () => void;

class SoilServiceImpl {
  private key = "km_soil_service_state";
  private listeners = new Set<Listener>();
  private state: SoilState = {
    soil_type: "black",
    ph: 7.0,
    season: "kharif",
    loading: false,
    result: null,
    error: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
      } catch {}
    }
  }

  private emit() {
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch {}
    for (const l of Array.from(this.listeners)) l();
  }
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  getSnapshot() { return this.state; }

  setSoilType(v: string) { this.state = { ...this.state, soil_type: v }; this.emit(); }
  setPh(v: number) { this.state = { ...this.state, ph: v }; this.emit(); }
  setSeason(v: string) { this.state = { ...this.state, season: v }; this.emit(); }

  async recommend(baseUrl: string, language: string) {
    if (this.state.loading) return;
    this.state = { ...this.state, loading: true, error: null, result: null };
    this.emit();
    try {
      const payload = { soil: { soil_type: this.state.soil_type, ph: this.state.ph, season: this.state.season }, language };
      const res = await fetch(`${baseUrl}/api/v1/ai/recommend/soil`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.state = { ...this.state, loading: false, result: data };
      this.emit();
    } catch (e: any) {
      this.state = { ...this.state, loading: false, error: e?.message || 'Failed' };
      this.emit();
    }
  }
}

export const SoilService = new SoilServiceImpl();

export function useSoilService() {
  const subscribe = (l: Listener) => SoilService.subscribe(l);
  const getSnapshot = () => SoilService.getSnapshot();
  const getServerSnapshot = () => ({ soil_type: "black", ph: 7.0, season: "kharif", loading: false, result: null, error: null });
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const baseRef = useRef<string>("");
  if (!baseRef.current) baseRef.current = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000");

  return {
    state,
    setSoilType: (v: string) => SoilService.setSoilType(v),
    setPh: (v: number) => SoilService.setPh(v),
    setSeason: (v: string) => SoilService.setSeason(v),
    recommend: (language: string) => SoilService.recommend(baseRef.current, language),
  };
}
