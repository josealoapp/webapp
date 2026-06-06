"use client";

import { useEffect, useRef, useState } from "react";

const SPLASH_SEEN_KEY = "josealo_home_splash_seen";
const SPLASH_FALLBACK_MS = 3500;

export default function HomeSplashScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }

    const timeoutId = window.setTimeout(() => setVisible(false), SPLASH_FALLBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <video
          ref={videoRef}
          autoPlay
          muted
          preload="auto"
          playsInline
          className="h-14 w-14 object-contain"
          aria-label="Josealo cargando"
          onLoadedData={(event) => {
            const video = event.currentTarget;
            video.currentTime = 0;
            void video.play().catch(() => undefined);
          }}
          onEnded={() => setVisible(false)}
        >
          <source src="/logo-splash.mp4" type="video/mp4" />
          <source src="/logo-splash.webm" type="video/webm" />
        </video>
        <div className="text-xl font-semibold tracking-normal text-white">Josealo</div>
      </div>
    </div>
  );
}
