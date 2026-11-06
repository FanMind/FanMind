import { RegistrationCallbackRedirect } from "@/components/RegistrationCallbackRedirect";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { MarketingConsentManager } from "@/components/marketing/MarketingConsentManager";
import {
  FANMIND_MARKETING_CONSENT_COOKIE,
  normalizeMarketingConsent,
} from "@/lib/metaPixelPolicy.mjs";
import { FANMIND_LOCALE_COOKIE, normalizeWorkspaceLocale } from "@/lib/workspaceLocale";
import { FANMIND_BRIGHTNESS_COOKIE, getThemeClass, normalizeFanMindBrightness } from "@/lib/userPreferences";
import { fanMindDescription, fanMindOgAlt, fanMindSiteUrl, fanMindTitle } from "./brandMetadata";
import "./globals.css";
import "./landing-header-visibility.css";

const browserIconRevision = "fanmind-social-avatar-exact-20260725";
const browserIconAsset = `/assets/fanmind-social-avatar.png?v=${browserIconRevision}`;

export const metadata: Metadata = {
  metadataBase: new URL(fanMindSiteUrl),
  referrer: "strict-origin-when-cross-origin",
  title: {
    default: fanMindTitle,
    template: "%s | FanMind",
  },
  description: fanMindDescription,
  applicationName: "FanMind",
  openGraph: {
    title: fanMindTitle,
    description: fanMindDescription,
    url: fanMindSiteUrl,
    siteName: "FanMind",
    type: "website",
    locale: "de_CH",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: fanMindOgAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: fanMindTitle,
    description: fanMindDescription,
    images: [
      {
        url: "/twitter-image",
        alt: fanMindOgAlt,
      },
    ],
  },
  icons: {
    icon: [
      {
        url: browserIconAsset,
        type: "image/png",
        sizes: "96x96",
      },
    ],
    shortcut: [
      {
        url: browserIconAsset,
        type: "image/png",
        sizes: "96x96",
      },
    ],
    apple: [
      {
        url: browserIconAsset,
        type: "image/png",
        sizes: "96x96",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = normalizeWorkspaceLocale(cookieStore.get(FANMIND_LOCALE_COOKIE)?.value);
  const brightness = normalizeFanMindBrightness(cookieStore.get(FANMIND_BRIGHTNESS_COOKIE)?.value);
  const marketingConsent = normalizeMarketingConsent(
    cookieStore.get(FANMIND_MARKETING_CONSENT_COOKIE)?.value,
  );
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

  return (
    <html lang={locale} className={getThemeClass(brightness)} style={{ "--fanmind-brightness-filter": String(brightness / 80), "--fanmind-dimmer": String(brightness), "--fanmind-dimmer-bg-lift": String(Math.max(0, (brightness - 80) / 40)) } as Record<string, string>} suppressHydrationWarning>
      <body>
        <RegistrationCallbackRedirect />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var b=localStorage.getItem("fanmind_brightness");var l=localStorage.getItem("fanmind_locale");if(l==="de"||l==="en")document.documentElement.lang=l;var n=b==="standard"?80:b==="brighter"?100:b==="light"?120:parseInt(b||"80",10);if(!isFinite(n))n=80;n=Math.max(50,Math.min(120,n));document.documentElement.classList.remove("fanmind-theme-standard","fanmind-theme-brighter","fanmind-theme-light");document.documentElement.classList.add(n>=115?"fanmind-theme-light":n>=95?"fanmind-theme-brighter":"fanmind-theme-standard");document.documentElement.style.setProperty("--fanmind-dimmer",String(n));document.documentElement.style.setProperty("--fanmind-brightness-filter",String(n/80));document.documentElement.style.setProperty("--fanmind-dimmer-bg-lift",String(Math.max(0,(n-80)/40)));}catch(e){}`,
          }}
        />
        {children}
        <Suspense fallback={null}>
          <MarketingConsentManager
            initialConsent={marketingConsent}
            pixelId={metaPixelId}
            locale={locale}
          />
        </Suspense>
      </body>
    </html>
  );
}
