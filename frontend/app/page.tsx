"use client";

import { useState } from "react";
import RazorpayCheckoutButton from "../components/RazorpayCheckoutButton";
import { recommendSoil } from "../lib/api";

export default function Page() {
  const [soilType, setSoilType] = useState("black");
  const [ph, setPh] = useState(7.0);
  const [season, setSeason] = useState("kharif");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await recommendSoil({ soil: { soil_type: soilType, ph, season }, language });
      setResult(data);
    } catch (e: any) {
      setResult({ error: e?.message || "Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>KrishiMitra</h1>
      <div className="card">
        <h2>Soil-based Recommendations</h2>
        <label>Soil Type</label>
        <select value={soilType} onChange={(e) => setSoilType(e.target.value)}>
          <option value="black">Black</option>
          <option value="alluvial">Alluvial</option>
          <option value="red">Red</option>
          <option value="loamy">Loamy</option>
          <option value="sandy">Sandy</option>
        </select>
        <label>pH</label>
        <input type="number" value={ph} step="0.1" onChange={(e) => setPh(parseFloat(e.target.value))} />
        <label>Season</label>
        <select value={season} onChange={(e) => setSeason(e.target.value)}>
          <option value="kharif">Kharif</option>
          <option value="rabi">Rabi</option>
          <option value="zaid">Zaid</option>
        </select>
        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="mr">Marathi</option>
          <option value="te">Telugu</option>
        </select>
        <button onClick={submit} disabled={loading}>{loading ? "Loading..." : "Get Recommendations"}</button>
        {result && (
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>

      <div className="card">
        <h2>Buy seeds/tools (Demo Payment)</h2>
        <RazorpayCheckoutButton amountPaise={5000} label="Pay ₹50" />
      </div>
    </div>
  );
}
