"use client";
import { useRef } from "react";

export default function Farmer3D() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y / rect.height) - 0.5) * -12; // tilt up/down
    const ry = ((x / rect.width) - 0.5) * 12;  // tilt left/right
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return; el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div className="relative w-[260px] h-[260px] select-none" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={ref} className="transition-transform duration-200 ease-out w-full h-full rounded-2xl shadow-2xl"
           style={{ transform: "perspective(800px)" }}>
        <div className="relative w-full h-full rounded-2xl overflow-hidden">
          {/* Background layers for parallax */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700/60 to-amber-600/40" />
          <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-emerald-500/30 blur-2xl" />
          <div className="absolute -bottom-10 -right-14 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl" />
          {/* Farmer emoji as 3D card content */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-7xl drop-shadow-[0_12px_12px_rgba(0,0,0,0.4)]">👨‍🌾</div>
          </div>
          {/* Ground strip */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-900/70 to-transparent" />
        </div>
      </div>
    </div>
  );
}