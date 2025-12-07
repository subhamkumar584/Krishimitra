"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "../../../lib/auth";

export default function LoginPage() {
  function backends() {
    const cfg = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();
    return [
      '', // Next.js proxy first (relative)
      cfg ? cfg : '',
      'http://127.0.0.1:8000',
      'http://localhost:8000'
    ].filter((v, i, a) => v !== undefined && v !== null && (i === a.findIndex(x => x === v)));
  }

  async function postJSON(url: string, payload: any) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function demoLogin(role: 'farmer' | 'customer' | 'admin' | 'equipmetal') {
    const email = `demo_${role}@example.com`;
    const password = 'demo1234';
    const payloadLogin = { email, password };
    const payloadRegister = { email, password, name: role.toUpperCase(), role };

    const bases = backends();
    let lastErr: any = null;

    for (const base of bases) {
      try {
        const loginURL = `${base}/api/v1/auth/login`;
        let resp = await postJSON(loginURL, payloadLogin);
        if (!resp.ok) {
          const registerURL = `${base}/api/v1/auth/register`;
          await postJSON(registerURL, payloadRegister);
          resp = await postJSON(loginURL, payloadLogin);
        }
        if (resp.ok && resp.data?.token && resp.data?.user) {
          saveAuth({ token: resp.data.token, user: resp.data.user });
          router.push('/dashboard');
          return;
        } else {
          lastErr = resp.data || { error: `HTTP ${resp.status}` };
        }
      } catch (e: any) {
        lastErr = { error: e?.message || 'Network error' };
        continue;
      }
    }

    setResult(lastErr || { error: 'Unable to reach backend. Make sure servers are running.' });
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const login = async () => {
    try {
      const bases = backends();
      let lastErr: any = null;
      for (const base of bases) {
        try {
          const r = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
          const data = await r.json().catch(() => ({}));
          if (r.ok && data?.token && data?.user) {
            setResult(data);
            saveAuth({ token: data.token, user: data.user });
            router.push('/dashboard');
            return;
          } else {
            lastErr = data?.error || `HTTP ${r.status}`;
          }
        } catch (e: any) {
          lastErr = e?.message || 'Network error';
          continue;
        }
      }
      setResult({ error: lastErr || 'Unable to reach backend. Make sure servers are running.' });
    } catch (e: any) {
      setResult({ error: e?.message || 'Network error. Is the dev server running?' });
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-md">
        <div className="card border border-[color:var(--border)]/70 shadow-2xl">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-white/70">Login to continue</p>
          <label className="mt-4">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary mt-4 w-full" onClick={login}>Login</button>
          <div className="mt-4 grid gap-2">
            <button className="btn btn-secondary w-full" onClick={() => demoLogin("farmer")}>Login as Demo Farmer</button>
            <button className="btn btn-secondary w-full" onClick={() => demoLogin("customer")}>Login as Demo Customer</button>
            <button className="btn btn-secondary w-full" onClick={() => demoLogin("admin")}>Login as Demo Admin</button>
            <button className="btn btn-secondary w-full" onClick={() => demoLogin("equipmetal")}>Login as Demo Equipmetal</button>
          </div>
          <p className="text-sm text-white/70 mt-3 text-center">New here? <a className="text-emerald-300 underline" href="/auth/register">Create account</a></p>
          {result && <pre className="mt-4 text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}
