"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../../lib/auth";

export default function CustomerDashboard() {
  const router = useRouter();
  useEffect(() => {
    const a = getAuth();
    if (!a) { router.replace('/auth/login'); return; }
    if (a.user.role !== 'customer') { router.replace('/dashboard'); }
  }, [router]);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Customer Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="card">
          <h2 className="text-xl font-semibold">Marketplace</h2>
          <p className="text-white/70 text-sm">Browse and buy farm products.</p>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold">Orders</h2>
          <p className="text-white/70 text-sm">View and track your orders.</p>
        </div>
      </div>
    </div>
  );
}
