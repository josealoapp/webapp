"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      execution?: "render" | "execute";
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  execute: (container?: HTMLElement | string) => void;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  action: string;
  onError?: () => void;
};

export type TurnstileWidgetHandle = {
  execute: () => Promise<string>;
  reset: () => void;
};

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { action, onError },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const pendingRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const resetWidget = () => {
    pendingRef.current = null;
    if (!window.turnstile || !widgetIdRef.current) return;
    window.turnstile.reset(widgetIdRef.current);
  };

  useImperativeHandle(ref, () => ({
    execute: () => {
      if (!siteKey) {
        return Promise.reject(new Error("turnstile/not-configured"));
      }
      if (!window.turnstile || !widgetIdRef.current) {
        return Promise.reject(new Error("turnstile/not-ready"));
      }

      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        window.turnstile?.execute(containerRef.current || undefined);
      });
    },
    reset: resetWidget,
  }));

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      execution: "execute",
      appearance: "execute",
      callback: (token) => {
        pendingRef.current?.resolve(token);
        pendingRef.current = null;
      },
      "expired-callback": () => {
        pendingRef.current?.reject(new Error("turnstile/expired"));
        pendingRef.current = null;
      },
      "error-callback": () => {
        pendingRef.current?.reject(new Error("turnstile/failed"));
        pendingRef.current = null;
        onError?.();
      },
    });
  }, [action, onError, scriptReady]);

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
});
