"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DemoTurnstile.module.css";

type TurnstileWidgetOptions = {
  sitekey: string;
  action: string;
  theme: "auto" | "light" | "dark";
  size: "normal" | "compact" | "flexible";
  language: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": (errorCode?: string) => void;
};

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    options: TurnstileWidgetOptions,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type DemoTurnstileProps = {
  siteKey: string;
  language: "de" | "en";
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
};

type WidgetState = "loading" | "ready" | "verified" | "error";

const TURNSTILE_SCRIPT_ID = "fanmind-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileLoader: Promise<TurnstileApi> | null = null;

function waitForTurnstileApi(timeoutMs = 10000): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(timer);
        resolve(window.turnstile);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Turnstile API konnte nicht geladen werden."));
      }
    }, 100);
  });
}

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener(
      "error",
      () => reject(new Error("Turnstile-Skript konnte nicht geladen werden.")),
      { once: true },
    );

    waitForTurnstileApi().then(resolve).catch(reject);
  }).catch((error) => {
    turnstileLoader = null;
    throw error;
  });

  return turnstileLoader;
}

function getWidgetSize(container: HTMLElement): TurnstileWidgetOptions["size"] {
  const availableWidth = container.getBoundingClientRect().width;
  return availableWidth > 0 && availableWidth < 300 ? "compact" : "flexible";
}

export function DemoTurnstile({
  siteKey,
  language,
  resetSignal,
  onTokenChange,
}: DemoTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const tokenChangeRef = useRef(onTokenChange);
  const [state, setState] = useState<WidgetState>("loading");

  useEffect(() => {
    tokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let disposed = false;
    tokenChangeRef.current(null);

    loadTurnstileApi()
      .then((api) => {
        if (disposed || !containerRef.current) return;
        const container = containerRef.current;
        apiRef.current = api;
        widgetIdRef.current = api.render(container, {
          sitekey: siteKey,
          action: "fanmind_demo_start",
          theme: "auto",
          size: getWidgetSize(container),
          language,
          callback: (token) => {
            tokenChangeRef.current(token);
            setState("verified");
          },
          "expired-callback": () => {
            tokenChangeRef.current(null);
            setState("ready");
          },
          "timeout-callback": () => {
            tokenChangeRef.current(null);
            setState("ready");
          },
          "error-callback": () => {
            tokenChangeRef.current(null);
            setState("error");
          },
        });
        setState("ready");
      })
      .catch(() => {
        if (disposed) return;
        tokenChangeRef.current(null);
        setState("error");
      });

    return () => {
      disposed = true;
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      if (api && widgetId) api.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [language, siteKey]);

  useEffect(() => {
    if (resetSignal <= 0) return;

    tokenChangeRef.current(null);
    if (apiRef.current && widgetIdRef.current) {
      apiRef.current.reset(widgetIdRef.current);
    }

    const timer = window.setTimeout(() => setState("ready"), 0);
    return () => window.clearTimeout(timer);
  }, [resetSignal]);

  if (!siteKey) return null;

  const statusText =
    state === "verified"
      ? language === "en"
        ? "Bot protection confirmed."
        : "Bot-Schutz bestätigt."
      : state === "error"
        ? language === "en"
          ? "Bot protection could not be loaded. Please try again."
          : "Bot-Schutz konnte nicht geladen werden. Bitte erneut versuchen."
        : language === "en"
          ? "Complete bot protection before starting the demo."
          : "Bitte bestätige den Bot-Schutz vor dem Demo-Start.";

  return (
    <section className={styles.card} aria-label="Cloudflare Turnstile Bot-Schutz">
      <div className={styles.heading}>
        <strong>{language === "en" ? "Bot protection" : "Bot-Schutz"}</strong>
        <span data-state={state}>{statusText}</span>
      </div>
      <div className={styles.widget} ref={containerRef} />
      <noscript>
        {language === "en"
          ? "JavaScript is required to start the public demo."
          : "JavaScript ist erforderlich, um die öffentliche Demo zu starten."}
      </noscript>
    </section>
  );
}
