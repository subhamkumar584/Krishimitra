"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "../../lib/auth";

import HomeLanding from "../../components/HomeLanding";

export default function FarmerDashboard() {
  const router = useRouter();
  useEffect(() => {
    const a = getAuth();
    if (!a) { router.replace('/auth/login'); return; }
    // Farmers get full home experience
  }, [router]);

  return (
    <HomeLanding />
  );
}
