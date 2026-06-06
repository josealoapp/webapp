"use client";

import { useEffect, useRef, useState } from "react";

const SPLASH_SEEN_KEY = "josealo_home_splash_seen";
const SPLASH_FALLBACK_MS = 3500;
const MOBILE_SPLASH_VISIBLE_MS = 1000;
const MOBILE_SPLASH_FADE_MS = 1000;

export default function HomeSplashScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncScreenSize = () => setIsDesktop(media.matches);
    syncScreenSize();
    media.addEventListener("change", syncScreenSize);

    try {
      if (!window.sessionStorage.getItem(SPLASH_SEEN_KEY)) {
        window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }

    return () => media.removeEventListener("change", syncScreenSize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setFading(false);

    if (!isDesktop) {
      const fadeTimeoutId = window.setTimeout(() => setFading(true), MOBILE_SPLASH_VISIBLE_MS);
      const hideTimeoutId = window.setTimeout(
        () => setVisible(false),
        MOBILE_SPLASH_VISIBLE_MS + MOBILE_SPLASH_FADE_MS
      );

      return () => {
        window.clearTimeout(fadeTimeoutId);
        window.clearTimeout(hideTimeoutId);
      };
    }

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }

    const timeoutId = window.setTimeout(() => setVisible(false), SPLASH_FALLBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isDesktop, visible]);

  if (!visible) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white transition-opacity duration-1000",
        fading ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-4">
        {isDesktop ? (
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
            <source src="/logo-splash.webm" type="video/webm" />
            <source src="/logo-splash.mp4" type="video/mp4" />
          </video>
        ) : (
          <img src="/logo.png" alt="Josealo" className="h-14 w-14 object-contain" />
        )}
        <div className="text-xl font-semibold tracking-normal text-white">Josealo</div>
      </div>
    </div>
  );
}
