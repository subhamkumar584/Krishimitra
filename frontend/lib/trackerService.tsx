"use client";

import { useRef, useSyncExternalStore } from "react";

export type TrackerState = {
  crop: string;
  season: string;
  start: string;
  planning: boolean;
  plan: any | null;
  error: string | null;
};

type Listener = () => void;

class TrackerServiceImpl {
  private key = "km_tracker_service_state";
  private listeners = new Set<Listener>();
  private state: TrackerState = {
    crop: "",
    season: "kharif",
    start: "",
    planning: false,
    plan: null,
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

  setCrop(v: string) { this.state = { ...this.state, crop: v }; this.emit(); }
  setSeason(v: string) { this.state = { ...this.state, season: v }; this.emit(); }
  setStart(v: string) { this.state = { ...this.state, start: v }; this.emit(); }

  async createPlan(baseUrl: string, lang: string) {
    if (this.state.planning) return;
    this.state = { ...this.state, planning: true, error: null, plan: null };
    this.emit();
    try {
      const res = await fetch(`${baseUrl}/api/v1/tracker/plan-ai`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: this.state.crop, season: this.state.season, start: this.state.start, language: lang })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.state = { ...this.state, planning: false, plan: data, error: null };
      this.emit();
    } catch (e: any) {
      this.state = { ...this.state, planning: false, error: e?.message || 'Failed' };
      this.emit();
    }
  }
}

export const TrackerService = new TrackerServiceImpl();

export function useTrackerService() {
  const subscribe = (l: Listener) => TrackerService.subscribe(l);
  const getSnapshot = () => TrackerService.getSnapshot();
  const getServerSnapshot = () => ({ crop: "", season: "kharif", start: "", planning: false, plan: null, error: null });

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const baseRef = useRef<string>("");
  if (!baseRef.current) baseRef.current = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000");

  return {
    state,
    setCrop: (v: string) => TrackerService.setCrop(v),
    setSeason: (v: string) => TrackerService.setSeason(v),
    setStart: (v: string) => TrackerService.setStart(v),
    createPlan: (lang: string) => TrackerService.createPlan(baseRef.current, lang)
  };
}
