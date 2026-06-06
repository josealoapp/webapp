"use client";

import { useEffect, useState } from "react";

const SPLASH_SEEN_KEY = "josealo_home_splash_seen";
const SPLASH_FALLBACK_MS = 3500;

export default function HomeSplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SPLASH_SEEN_KEY)) return;
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => setVisible(false), SPLASH_FALLBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <video
          src="/logo-splash.webm"
          autoPlay
          muted
          playsInline
          className="h-14 w-14 object-contain"
          aria-label="Josealo cargando"
          onEnded={() => setVisible(false)}
        />
        <div className="text-xl font-semibold tracking-normal text-white">Josealo</div>
      </div>
    </div>
  );
}
