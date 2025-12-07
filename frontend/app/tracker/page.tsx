"use client";
import { useEffect, useState } from "react";

import { useI18n } from "../../lib/i18n";
import { useTrackerService } from "../../lib/trackerService";

export default function TrackerPage() {
  const { state: ts, setCrop, setSeason, setStart, createPlan } = useTrackerService();
  const crop = ts.crop;
  const season = ts.season;
  const start = ts.start;
  const planAI = ts.plan;
  const planning = ts.planning;
  const { t, lang } = useI18n();

  const onCreatePlan = async () => {
    await createPlan(lang);
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">{t('feature.tracker')}</h1>
      <div className="card mt-6">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label>{t('labels.crop')}</label>
            <input value={crop} onChange={(e) => setCrop(e.target.value)} />
          </div>
          <div>
            <label>{t('tracker.season_label')}</label>
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="kharif">Kharif</option>
              <option value="rabi">Rabi</option>
              <option value="zaid">Zaid</option>
            </select>
          </div>
          <div>
            <label>{t('labels.start_date')}</label>
            <input type="date" className="bg-[color:var(--card)] text-[color:var(--foreground)]" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>
        {ts.error && <p className="text-amber-400 mt-3 text-sm">{ts.error}</p>}
        <button className="btn btn-primary mt-4" onClick={onCreatePlan} disabled={planning}>{planning ? t('busy.planning') : t('buttons.create_plan')}</button>
      </div>

      {/* AI Plan Result */}
      {planAI && planAI.plan && (
        <div className="grid mt-6 gap-4">
          <div className="card">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold">{planAI.plan.crop}</h3>
                <p className="text-white/70 text-sm">{t('tracker.season_label')}: {planAI.plan.season || '—'} {planAI.plan.start ? `• ${t('labels.start_date')}: ${planAI.plan.start}` : ''}</p>
              </div>
              <span className="text-xs text-white/50">{planAI.model || ''}</span>
            </div>
            <div className="mt-4 space-y-3">
              {(planAI.plan.stages || []).map((s: any, idx: number) => (
                <div key={idx} className="border border-[color:var(--border)] rounded-lg p-4">
                  <div className="flex justify-between">
                    <h4 className="text-lg font-semibold">{s.name}</h4>
                    <span className="text-white/60 text-sm">{t('tracker.day_range')} {s.start_day}–{s.end_day}</span>
                  </div>
                  {s.tasks && s.tasks.length > 0 && (
                    <div className="mt-2">
                      <p className="text-white/70 text-sm font-semibold">{t('tracker.tasks')}</p>
                      <ul className="list-disc list-inside text-white/80 text-sm">
                        {s.tasks.map((tstr: string, i: number) => (<li key={i}>{tstr}</li>))}
                      </ul>
                    </div>
                  )}
                  {s.alerts && s.alerts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-amber-400 text-sm font-semibold">{t('tracker.alerts')}</p>
                      <ul className="list-disc list-inside text-amber-300 text-sm">
                        {s.alerts.map((a: string, i: number) => (<li key={i}>{a}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {planAI.recommendations && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {/* Fertilizer */}
                <div className="border border-[color:var(--border)] rounded-lg p-4">
                  <h4 className="text-lg font-semibold">{t('tracker.fertilizer_plan')}</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm mt-2">
                    {planAI.recommendations.fertilizer?.basal && <li><strong>Basal:</strong> {planAI.recommendations.fertilizer.basal}</li>}
                    {planAI.recommendations.fertilizer?.top_dressing && <li><strong>Top dressing:</strong> {planAI.recommendations.fertilizer.top_dressing}</li>}
                    {planAI.recommendations.fertilizer?.micronutrients && <li><strong>Micronutrients:</strong> {planAI.recommendations.fertilizer.micronutrients}</li>}
                    {planAI.recommendations.fertilizer?.npk_ratio && <li><strong>NPK ratio:</strong> {planAI.recommendations.fertilizer.npk_ratio}</li>}
                  </ul>
                </div>
                {/* Soil guidance */}
                <div className="border border-[color:var(--border)] rounded-lg p-4">
                  <h4 className="text-lg font-semibold">{t('tracker.soil_guidance')}</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm mt-2">
                    {planAI.recommendations.soil?.ideal_types && <li><strong>{t('tracker.soil_guidance')} - Ideal types:</strong> {(planAI.recommendations.soil.ideal_types || []).join(', ')}</li>}
                    {planAI.recommendations.soil?.ph_range && <li><strong>pH range:</strong> {planAI.recommendations.soil.ph_range}</li>}
                    {planAI.recommendations.soil?.prep && <li><strong>Preparation:</strong> {planAI.recommendations.soil.prep}</li>}
                  </ul>
                </div>
                {/* Crop details */}
                <div className="border border-[color:var(--border)] rounded-lg p-4">
                  <h4 className="text-lg font-semibold">{t('tracker.crop_details')}</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm mt-2">
                    {planAI.recommendations.crop_details?.varieties && <li><strong>{t('tracker.varieties')}:</strong> {(planAI.recommendations.crop_details.varieties || []).join(', ')}</li>}
                    {planAI.recommendations.crop_details?.seed_rate && <li><strong>{t('tracker.seed_rate')}:</strong> {planAI.recommendations.crop_details.seed_rate}</li>}
                    {planAI.recommendations.crop_details?.spacing && <li><strong>{t('tracker.spacing')}:</strong> {planAI.recommendations.crop_details.spacing}</li>}
                    {planAI.recommendations.crop_details?.irrigation && <li><strong>{t('tracker.irrigation')}:</strong> {planAI.recommendations.crop_details.irrigation}</li>}
                    {planAI.recommendations.crop_details?.season && <li><strong>{t('tracker.season_label')}:</strong> {planAI.recommendations.crop_details.season}</li>}
                  </ul>
                </div>
                {/* Diseases and pests */}
                <div className="border border-[color:var(--border)] rounded-lg p-4">
                  <h4 className="text-lg font-semibold">{t('tracker.diseases_pests')}</h4>
                  <ul className="list-disc list-inside text-white/80 text-sm mt-2">
                    {(planAI.recommendations.diseases || []).map((d: any, i: number) => (
                      <li key={i} className="mt-1">
                        <span className="font-semibold">{d.name}:</span> {d.symptoms ? `${t('tracker.symptoms')}: ${d.symptoms}. ` : ''}{d.management ? `${t('tracker.management')}: ${d.management}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {planAI.notes && <p className="text-white/60 text-sm mt-4">{planAI.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
