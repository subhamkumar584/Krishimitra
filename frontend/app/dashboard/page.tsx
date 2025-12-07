"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../../lib/auth";

export default function DashboardRouter() {
  const router = useRouter();
  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/auth/login");
      return;
    }
    const role = auth.user.role;
    if (role === 'admin') router.replace('/admin');
    else if (role === 'customer' || role === 'equipmetal') router.replace('/marketplace');
    else router.replace('/farmer');
  }, [router]);
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold">Redirecting to your dashboard…</h1>
    </div>
  );
}
