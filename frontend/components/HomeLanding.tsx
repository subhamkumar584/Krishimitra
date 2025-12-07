"use client";

import Link from "next/link";
import { useI18n } from "../lib/i18n";
import { Sprout, CloudSun, ShoppingBasket, Bot, Leaf, IndianRupee, Image as ImageIcon } from "lucide-react";
import RazorpayCheckoutButton from "./RazorpayCheckoutButton";
import { useSoilService } from "../lib/soilService";
import { useEffect, useState } from "react";
import { getAuth } from "../lib/auth";

export default function HomeLanding() {
  const { t, lang } = useI18n();
  const { state: soil, setSoilType, setPh, setSeason, recommend } = useSoilService();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const auth = getAuth();
    setRole(auth?.user?.role || null);
  }, []);
  const soilType = soil.soil_type;
  const ph = soil.ph;
  const season = soil.season;
  const result = soil.result as any;
  const loading = soil.loading;

  const submit = async () => {
    await recommend(lang);
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-700/40 to-amber-600/20">
        <div className="container py-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            {t('home.hero_title')}
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl">
            {t('home.hero_subtitle')}
          </p>
          <div className="mt-8 flex gap-3">
            <Link className="btn btn-primary" href="/marketplace">{t('feature.marketplace')}</Link>
            <Link className="btn btn-secondary" href="/advisory">{t('nav.advisory')}</Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container py-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard icon={<ShoppingBasket className="text-amber-400"/>} title={t('feature.marketplace')} href="/marketplace" desc=""/>
        <FeatureCard icon={<Bot className="text-emerald-400"/>} title={t('feature.chatbot')} href="/chat" desc="">
          <a href="/disease" className="ml-auto inline-flex items-center gap-1 text-sm text-white/70 hover:text-white" title="Image diagnosis">
            <ImageIcon className="w-4 h-4" />
          </a>
        </FeatureCard>
        <FeatureCard icon={<CloudSun className="text-sky-400"/>} title={t('feature.weather')} href="/advisory" desc=""/>
        <FeatureCard icon={<Sprout className="text-lime-400"/>} title="Soil & Crop Recommendation" href="#soil" desc=""/>
        <FeatureCard icon={<Leaf className="text-green-400"/>} title={t('feature.tracker')} href="/tracker" desc=""/>
        <FeatureCard icon={<IndianRupee className="text-amber-400"/>} title={t('feature.prices')} href="/advisory" desc=""/>
      </section>

      {/* Soil Recommender */}
      <section id="soil" className="container py-10">
        <div className="card">
          <h2 className="text-2xl font-semibold">{t('soil.title')}</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label>{t('form.soil_type')}</label>
              <select value={soilType} onChange={(e) => setSoilType(e.target.value)}>
                <option value="black">Black</option>
                <option value="alluvial">Alluvial</option>
                <option value="red">Red</option>
                <option value="loamy">Loamy</option>
                <option value="sandy">Sandy</option>
              </select>
            </div>
            <div>
              <label>{t('form.ph')}</label>
              <input type="number" className="bg-[color:var(--card)] text-[color:var(--foreground)]" value={ph} step="0.1" onChange={(e) => setPh(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label>{t('form.season')}</label>
              <select value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="kharif">Kharif</option>
                <option value="rabi">Rabi</option>
                <option value="zaid">Zaid</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={submit} disabled={loading} className="btn btn-primary">
              {loading ? t('busy.analyzing') : t('form.get_reco')}
            </button>
            {/* Show seed purchase only for non-farmer/admin roles */}
            {role && role !== 'farmer' && role !== 'admin' ? (
              <RazorpayCheckoutButton amountPaise={5000} label="Buy Seeds ₹50" />
            ) : null}
          </div>
          {result && (
            <div className="mt-6 space-y-4">
              {/* Notes / Model */}
              <div className="text-xs text-white/50 flex items-center gap-3">
                {result.model && <span className="inline-block px-2 py-0.5 rounded border border-[color:var(--border)]">Model: {result.model}</span>}
                {result.notes && <span className="text-white/60">{result.notes}</span>}
              </div>
              {/* Recommendations Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {(result.recommendations || []).map((rec: any, idx: number) => (
                  <div key={idx} className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--card)]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{rec.crop || 'Crop'}</h3>
                      {rec.ideal_season && <span className="text-xs text-white/60">Season: {rec.ideal_season}</span>}
                    </div>
                    <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-white/80">
                      {rec.seed_rate && <div><span className="text-white/60">Seed rate:</span> {rec.seed_rate}</div>}
                      {rec.spacing && <div><span className="text-white/60">Spacing:</span> {rec.spacing}</div>}
                      {rec.irrigation && <div className="sm:col-span-2"><span className="text-white/60">Irrigation:</span> {rec.irrigation}</div>}
                    </div>
                    {rec.fertilizer && (
                      <div className="mt-3">
                        <p className="text-sm font-semibold">Fertilizer</p>
                        <ul className="list-disc list-inside text-white/80 text-sm mt-1">
                          {rec.fertilizer.basal && <li><strong>Basal:</strong> {rec.fertilizer.basal}</li>}
                          {rec.fertilizer.top_dressing && <li><strong>Top dressing:</strong> {rec.fertilizer.top_dressing}</li>}
                          {rec.fertilizer.micronutrients && <li><strong>Micronutrients:</strong> {rec.fertilizer.micronutrients}</li>}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(rec.steps) && rec.steps.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-semibold">Steps</p>
                        <ul className="list-disc list-inside text-white/80 text-sm mt-1">
                          {rec.steps.map((s: any, i: number) => (
                            <li key={i}>
                              {s.when ? <span className="text-white/60 mr-1">[{s.when}]</span> : null}
                              {s.step || s.details || JSON.stringify(s)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {rec.pest_disease_watch && (
                      <p className="mt-3 text-amber-300 text-sm"><strong>Watch:</strong> {rec.pest_disease_watch}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, href, children }: { icon: React.ReactNode; title: string; desc: string; href: string; children?: React.ReactNode }) {
  return (
    <div className="card hover:shadow-md hover:shadow-emerald-900/20 transition-shadow">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-emerald-900/30">
          {icon}
        </div>
        <a href={href} className="text-xl font-semibold hover:underline">{title}</a>
        {children}
      </div>
      <p className="mt-2 text-white/70 text-sm">{desc}</p>
      <div className="mt-3">
        <a href={href} className="btn btn-secondary">Open</a>
      </div>
    </div>
  );
}
