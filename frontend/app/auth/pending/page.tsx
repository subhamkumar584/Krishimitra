"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg p-6 text-center">
        <div className="flex items-center justify-center mb-3">
          <Loader2 className="w-6 h-6 animate-spin text-[color:var(--primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">Verifying your details</h1>
        <p className="text-[color:var(--foreground)]/70 mb-4">
          Your farmer account request has been received. An admin will review your details (Aadhaar, PAN, phone) and approve your account shortly.
        </p>
        <div className="text-sm text-[color:var(--foreground)]/60 mb-6">
          You will be able to login after approval. Please check back later.
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/auth/login" className="px-4 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
