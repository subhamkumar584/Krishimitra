"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "../../../lib/auth";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [role, setRole] = useState("farmer");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""; // use Next.js dev proxy when unset
      const body = { email, phone, password, name, role, aadhaar_number: aadhaar, pan_number: pan };
      const r = await fetch(`${base}/api/v1/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      // Farmer registration pending approval -> show verifying page
      if (!r.ok) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }
      if (data?.token && data?.user) {
        saveAuth({ token: data.token, user: data.user });
        router.push('/dashboard');
        return;
      }
      // No token returned: likely farmer pending admin approval
      router.push('/auth/pending');
    } catch (e: any) {
      setError(e?.message || 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-md">
        <div className="card border border-[color:var(--border)]/70 shadow-2xl">
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-sm text-white/70">Sign up to get started</p>
          <label className="mt-4">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label>Aadhaar Number</label>
          <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
          <label>PAN Number</label>
          <input value={pan} onChange={(e) => setPan(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="farmer">Farmer</option>
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={submitting} className="btn btn-primary mt-4 w-full flex items-center justify-center gap-2" onClick={register}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Sign Up</span>
          </button>
          <p className="text-sm text-white/70 mt-3 text-center">Already have an account? <a className="text-emerald-300 underline" href="/auth/login">Login</a></p>
          {error && <div className="mt-3 p-3 border border-red-800/30 bg-red-900/20 rounded text-red-300 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  );
}
