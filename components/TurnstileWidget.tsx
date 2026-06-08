"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  action: string;
  resetSignal: number;
  onToken: (token: string) => void;
  onError?: () => void;
};

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function TurnstileWidget({ action, resetSignal, onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        onToken("");
        onError?.();
      },
    });
  }, [action, onError, onToken, scriptReady]);

  useEffect(() => {
    if (!window.turnstile || !widgetIdRef.current) return;
    onToken("");
    window.turnstile.reset(widgetIdRef.current);
  }, [onToken, resetSignal]);

  if (!siteKey) {
    return (
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/30 p-3 text-xs text-amber-200">
        Falta configurar Cloudflare Turnstile.
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </div>
  );
}
