export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Auth pages: center the content; NavBar/Footer hidden via LayoutChrome
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-900 to-emerald-900 px-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
