"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  META_PIXEL_READY_EVENT,
  buildMetaPixelBootstrap,
  normalizeMetaPixelId,
} from "@/lib/metaPixelPolicy.mjs";
import {
  grantMetaPixelConsent,
  markMetaPixelInitialized,
  setFanMindMarketingConsent,
  trackMetaPixelPageView,
} from "@/lib/metaPixel";

export function MetaPixelLoader({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const normalizedPixelId = normalizeMetaPixelId(pixelId);
  const bootstrap = useMemo(
    () => buildMetaPixelBootstrap(normalizedPixelId),
    [normalizedPixelId],
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!normalizedPixelId) return;

    const activatePixel = () => {
      if (
        typeof window.fbq !== "function" ||
        window.__fanmindMetaPixelId !== normalizedPixelId
      ) {
        return;
      }
      setFanMindMarketingConsent("granted");
      if (!markMetaPixelInitialized(normalizedPixelId)) return;
      grantMetaPixelConsent();
      setReady(true);
    };

    // The inline bootstrap can run before or after this effect. The immediate
    // check covers the former; the readiness event covers the latter.
    activatePixel();
    window.addEventListener(META_PIXEL_READY_EVENT, activatePixel);
    return () =>
      window.removeEventListener(META_PIXEL_READY_EVENT, activatePixel);
  }, [normalizedPixelId]);

  useEffect(() => {
    if (!ready || !normalizedPixelId) return;
    trackMetaPixelPageView({
      pathname,
      search,
      hash: window.location.hash,
    });
  }, [normalizedPixelId, pathname, ready, search]);

  if (!normalizedPixelId || !bootstrap) return null;

  return (
    <Script id="fanmind-meta-pixel-bootstrap" strategy="afterInteractive">
      {bootstrap}
    </Script>
  );
}
