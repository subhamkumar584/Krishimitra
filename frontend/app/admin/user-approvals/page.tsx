"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminUserApprovalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = localStorage.getItem("km_auth");
      let token: string | null = null;
      if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
      if (!token) throw new Error("Authentication required");
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const res = await fetch(`${base}/api/v1/auth/pending-farmers`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.farmers || []);
      // Fetch providers
      const res2 = await fetch(`${base}/api/v1/auth/pending-providers`, { headers: { Authorization: `Bearer ${token}` } });
      if (res2.ok) {
        const data2 = await res2.json();
        setProviders(data2.providers || []);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (uid: number) => {
    try {
      const auth = localStorage.getItem("km_auth");
      let token: string | null = null;
      if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
      if (!token) throw new Error("Authentication required");
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const res = await fetch(`${base}/api/v1/auth/farmers/${uid}/approve`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPending();
      alert("Approved");
    } catch (e: any) {
      alert(e?.message || "Failed to approve");
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[color:var(--foreground)] mb-6">User Approval</h1>
        {loading && <div className="text-[color:var(--foreground)]/70">Loading...</div>}
        {error && <div className="p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400 mb-4">{error}</div>}
        {/* Farmers */}
        <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">Farmers</h2>
        {!loading && items.length === 0 && (
          <div className="p-4 border border-[color:var(--border)] rounded text-[color:var(--foreground)]/70 mb-6">No pending farmer approvals.</div>
        )}
        {!loading && items.length > 0 && (
          <div className="space-y-3 mb-8">
            {items.map((u) => (
              <div key={u.id} className="p-4 border border-[color:var(--border)] rounded bg-[color:var(--card)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[color:var(--foreground)] font-semibold">{u.name || 'Unnamed'} (ID #{u.id})</div>
                    <div className="text-sm text-[color:var(--foreground)]/70">Email: {u.email || '—'} | Phone: {u.phone || '—'}</div>
                    <div className="text-sm text-[color:var(--foreground)]/70">Aadhaar: {u.aadhaar_number || '—'} | PAN: {u.pan_number || '—'}</div>
                    <div className="text-xs text-[color:var(--foreground)]/50">Requested: {new Date(u.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => approve(u.id)} className="px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded hover:opacity-90">Approve</button>
                    <button onClick={async () => {
                      if (!confirm('Reject this farmer signup? This will delete the pending account.')) return;
                      try {
                        const auth = localStorage.getItem('km_auth');
                        let token: string | null = null;
                        if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
                        if (!token) throw new Error('Authentication required');
                        const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
                        const res = await fetch(`${base}/api/v1/auth/farmers/${u.id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        await fetchPending();
                        alert('Rejected');
                      } catch (e: any) {
                        alert(e?.message || 'Failed to reject');
                      }
                    }} className="px-4 py-2 bg-red-600 text-white rounded hover:opacity-90">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Equipmetal Providers */}
        <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">Providers (Equipmetal)</h2>
        {!loading && providers.length === 0 && (
          <div className="p-4 border border-[color:var(--border)] rounded text-[color:var(--foreground)]/70">No pending provider approvals.</div>
        )}
        {!loading && providers.length > 0 && (
          <div className="space-y-3">
            {providers.map((u) => (
              <div key={u.id} className="p-4 border border-[color:var(--border)] rounded bg-[color:var(--card)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[color:var(--foreground)] font-semibold">{u.name || 'Unnamed'} (ID #{u.id})</div>
                    <div className="text-sm text-[color:var(--foreground)]/70">Email: {u.email || '—'} | Phone: {u.phone || '—'}</div>
                    <div className="text-sm text-[color:var(--foreground)]/70">Company: {u.company_name || '—'} | GST: {u.gst_number || '—'}</div>
                    <div className="text-xs text-[color:var(--foreground)]/50">Requested: {new Date(u.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={async () => {
                      try {
                        const auth = localStorage.getItem('km_auth');
                        let token: string | null = null;
                        if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
                        if (!token) throw new Error('Authentication required');
                        const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
                        const res = await fetch(`${base}/api/v1/auth/providers/${u.id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        await fetchPending();
                        alert('Approved');
                      } catch (e: any) {
                        alert(e?.message || 'Failed to approve');
                      }
                    }} className="px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded hover:opacity-90">Approve</button>
                    <button onClick={async () => {
                      if (!confirm('Reject this provider signup? This will delete the pending account.')) return;
                      try {
                        const auth = localStorage.getItem('km_auth');
                        let token: string | null = null;
                        if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
                        if (!token) throw new Error('Authentication required');
                        const base = process.env.NEXT_PUBLIC_BACKEND_URL || '';
                        const res = await fetch(`${base}/api/v1/auth/providers/${u.id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        await fetchPending();
                        alert('Rejected');
                      } catch (e: any) {
                        alert(e?.message || 'Failed to reject');
                      }
                    }} className="px-4 py-2 bg-red-600 text-white rounded hover:opacity-90">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
