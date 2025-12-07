"use client";
import HomeLanding from "../../components/HomeLanding";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../../lib/auth";

export default function AdminDashboard() {
  const router = useRouter();
  useEffect(() => {
    const a = getAuth();
    if (!a) { router.replace('/auth/login'); return; }
    // Admins get full access; keep them here
  }, [router]);

  // Show the same dashboard as farmer
  return <HomeLanding />;
}
