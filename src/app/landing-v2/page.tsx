import type { Metadata } from "next";
import Image from "next/image";
import { roadmapNotes, roadmapPhases } from "@/config/roadmap";
import { createFanMindTranslator, getFanMindLanguage, landingPath, localizedPath, localizeFanMindValue, type FanMindLanguage } from "@/lib/fanmindCopy";
import { FanMindLogo } from "@/components/FanMindLogo";
import { ComingSoonMark } from "@/components/ComingSoonMark";
import { PlatformLogo } from "@/components/PlatformLogo";
import { FanMindFunctionIcon, resolveFanMindFunctionIcon } from "@/components/FanMindFunctionIcon";
import ProductShowcaseSection from "@/components/landing/ProductShowcaseSection";
import RoadmapShowcase from "./RoadmapShowcase";
import FaqAccordion from "./FaqAccordion";
import FeatureStatusLabel, { type FeatureStatusLabelVariant } from "@/components/FeatureStatusLabel";
import { FooterInquiryForm } from "@/components/landing/FooterInquiryForm";
import styles from "./landing-v2.module.css";

export const metadata: Metadata = {
  title: "FanMind | KI-CRM für Creator, Clubs und Events",
  description:
    "FanMind bündelt Kontakte, Gespräche, Kontaktwissen und Follow-ups für smarte Fan-Beziehungen; externe Integrationen bleiben bis zur technischen und rechtlichen Freigabe klar als Coming Soon markiert.",
};

const LANDING_ROADMAP_HREF = "#roadmap";

function statusVariantFromLabel(status?: string): FeatureStatusLabelVariant | undefined {
  if (!status) return undefined;
  if (["Roadmap", "In Kürze", "Coming Soon"].includes(status)) return "roadmap";
  if (["Beta / in Vorbereitung", "Pilot-Upgrade", "Auf Anfrage"].includes(status)) return "preview";
  if (["Vorschau", "Preview", "BETA"].includes(status)) return "preview";
  if (["Geplant", "Planned"].includes(status)) return "planned";
  if (["Aktiv", "Bereit", "Verfügbar", "Aktiv", "Active"].includes(status)) return "active";
  return undefined;
}

const comingSoonIntegrationPlatforms = new Set(["email", "discord", "whatsapp", "tiktok", "instagram", "x", "facebook"]);

const navItems = [
  { label: "Produkt", href: "#produkt-showcase" },
  { label: "Workflow", href: "#conversion" },
  { label: "Funktionen", href: "#features" },
  { label: "Preise", href: "#preise" },
  { label: "Roadmap", href: LANDING_ROADMAP_HREF },
  { label: "Kontakt", href: "#kontakt" },
];

const features = [
  {
    icon: "✉",
    title: "Kontakte / Fans",
    text: "Profile, Gesprächsnotizen, Tags und Kontaktverlauf werden zentral und nachvollziehbar gepflegt.",
    tone: "blue",
  },
  {
    icon: "🧠",
    title: "KI-Antwortvorschläge",
    text: "FanMind erstellt passende Entwürfe aus Kontext und Kontaktwissen. Du prüfst, kopierst und sendest selbst.",
    tone: "purple",
  },
  {
    icon: "♙",
    title: "CSV-Import & Kontaktwissen",
    text: "Bestehende Kontakte importieren, Details speichern und Follow-ups aus dem Kontext vorbereiten.",
    tone: "green",
  },
  {
    icon: "📣",
    title: "Manuelle Follow-ups",
    text: "Nächste Schritte bleiben sichtbar, priorisiert und bewusst manuell steuerbar.",
    tone: "orange",
  },
  {
    icon: "▥",
    title: "Roadmap",
    status: "Roadmap",
    text: "Kampagnen, Reichweiten-Analytics und Rollen/Rechte sind klar als spätere Ausbaustufen markiert.",
    tone: "cyan",
  },
  {
    icon: "⬟",
    title: "Kontrolle & Sicherheit",
    text: "Keine automatische Sendefunktion, keine Bankdaten in FanMind und sichere Zahlung über den Zahlungsanbieter.",
    tone: "violet",
  },
];

const problemCards = [
  {
    icon: "⌘",
    title: "Zu viele Kanäle",
    text: "E-Mails, Chats, Socials, WhatsApp und Formulare laufen parallel – aber nichts ist wirklich zentralisiert.",
    detail: "Informationen gehen verloren und Doppelarbeit entsteht.",
  },
  {
    icon: "🧠",
    title: "Zu wenig Gedächtnis",
    text: "Wichtige Details, Vorlieben und bisherige Interaktionen gehen unter. Jeder Kontakt fühlt sich wieder wie der erste an.",
    detail: "Keine persönliche Ansprache, weniger Bindung.",
  },
  {
    icon: "◷",
    title: "Zu wenig Timing",
    text: "Kein Überblick über Follow-ups und Kampagnen. Chancen werden verpasst, Antworten kommen zu spät – oder gar nicht.",
    detail: "Verpasste Gelegenheiten kosten Umsatz und Fans.",
  },
];

const solutionBenefits = [
  { icon: "♙", title: "Alle Kontakte", text: "an einem Ort." },
  { icon: "🧠", title: "Kontext & Historie", text: "für jede Interaktion." },
  { icon: "✦", title: "KI-Vorschläge & Abläufe", text: "unterstützen dich." },
  { icon: "⌁", title: "Klare nächste Schritte", text: "ohne Versandautomatik." },
];

const functionCards = [
  {
    icon: "♙",
    title: "1. Kontakte",
    text: "Alle Fans und Interaktionen an einem Ort.",
    body: "Sandra M. 92 · Alex 88 · Mia 85",
    cta: "Alle Kontakte ansehen",
    href: "#produkt-showcase",
    tone: "blue",
  },
  {
    icon: "🧠",
    title: "2. Kontaktwissen",
    text: "Wichtige Details, Interessen und Historie übersichtlich festhalten.",
    body: "VIP · premium_interessiert · Letzter Kontakt: Heute, 09:42",
    cta: "Details ansehen",
    href: "#fan-gedaechtnis",
    tone: "green",
  },
  {
    icon: "✦",
    title: "3. KI-Antworten",
    text: "KI liefert passende Vorschläge. Du prüfst und gibst frei.",
    body: "Vorschlag: Early-Bird Zugang und 10 % Rabatt sind noch verfügbar.",
    cta: "KI entdecken",
    href: "#ki",
    tone: "purple",
  },
  {
    icon: "▣",
    title: "4. Follow-ups",
    text: "Nächste Aktionen, Erinnerungen und Aufgaben im Blick.",
    body: "VIP-Upgrade Infos · Heute, 10:00 · Feedback abfragen",
    cta: "Alle Follow-ups",
    href: "#follow-ups",
    tone: "cyan",
  },
  {
    icon: "📣",
    title: "5. Kampagnen",
    status: "Roadmap",
    hideStatusLabel: true,
    text: "Kampagnen als geprüfte Entwürfe vorbereiten – Versand bleibt aktuell inaktiv und manuell abgegrenzt.",
    body: "Sommer-Event Early Bird · Vorschau · manuelle Freigabe",
    cta: "Roadmap ansehen",
    href: LANDING_ROADMAP_HREF,
    tone: "violet",
  },
  {
    icon: "⌁",
    title: "6. Analytics",
    status: "Roadmap",
    hideStatusLabel: true,
    text: "Roadmap-Ausblick für spätere Auswertungen und Wachstumssignale.",
    body: "Roadmap-Auswertung · In Kürze",
    cta: "Roadmap öffnen",
    href: LANDING_ROADMAP_HREF,
    tone: "green",
  },
];

const sixStepCards = [
  {
    step: "1",
    title: "Kontakt erfassen",
    copy: "Neue Kontakte aus Formularen, E-Mail, Chat oder Import sauber erfassen und zentral ablegen.",
    cardTitle: "Neuer Kontakt",
    icon: "♙",
    tone: "blue",
    rows: [
      "Avatar SM · Sandra M.",
      "sandra@mania-club.com",
      "+43 660 123 45 67",
      "VIP interessiert",
      "Quelle: Website-Formular, E-Mail-Postfach, WhatsApp Chat",
      "Kontakt gespeichert",
    ],
    cta: "Details anzeigen",
    href: "#kontakte",
  },
  {
    step: "2",
    title: "Kontaktwissen aufbauen",
    copy: "Relevante Infos, Interessen und Interaktionen zentral speichern und sinnvoll verknüpfen.",
    cardTitle: "Kontaktwissen",
    icon: "🧠",
    tone: "cyan",
    rows: [
      "Interessen: Sommer-Event, VIP-Angebote",
      "Kaufhistorie: 2 Upsells gekauft",
      "Tonalität: freundlich, wertschätzend",
      "Letzter Kontakt: Heute, 09:42",
    ],
    cta: "Details anzeigen",
    href: "#fan-gedaechtnis",
  },
  {
    step: "3",
    title: "KI-Antwort erhalten",
    copy: "Die KI liefert passende Antwortvorschläge zum Kontext – dein Team prüft und gibt frei.",
    cardTitle: "KI-Antwortvorschläge",
    icon: "✦",
    tone: "purple",
    badge: "BETA",
    rows: [
      "Hi Sandra! Der Vorverkauf startet am 18. Mai um 10:00 Uhr.",
      "Als Member erhältst du 10 % Rabatt in den ersten 48 Stunden.",
      "Danke für dein Interesse! Melde dich gerne bei weiteren Fragen.",
      "Freigabe durch Mensch erforderlich",
    ],
    cta: "Mehr Vorschläge anzeigen",
    href: "#ki",
  },
  {
    step: "4",
    title: "Follow-up planen",
    copy: "Zur richtigen Zeit mit der passenden Botschaft – vorbereitet, priorisiert und manuell steuerbar.",
    cardTitle: "Follow-up planen",
    icon: "☑",
    tone: "blue",
    rows: [
      "Nächster Schritt: VIP-Infos + Friend-Ticket",
      "Manuelle Erinnerung: Heute, 10:00",
      "Kanäle notieren: E-Mail-Kontext vorbereiten, weitere Kanäle Roadmap",
      "Priorität: Hoch",
      "Owner: Nina D.",
    ],
    cta: "Alle Follow-ups anzeigen",
    href: "#follow-ups",
  },
  {
    step: "5",
    title: "Kampagne vorbereiten",
    copy: "Segmentierte Kampagnen als Roadmap-Vorschau vorbereiten, prüfen und ohne aktiven Versand einordnen.",
    cardTitle: "Sommer-Event Early Bird",
    icon: "📣",
    tone: "green",
    showComingSoonMark: true,
    rows: [
      "Zielgruppe: 1.260",
      "Roadmap: Segment- und Kampagnenplanung",
      "Versand: inaktiv / manuell abgegrenzt",
      "Kanäle: E-Mail-Kontext vorbereitet, weitere Kanäle Roadmap",
      "Status: Vorschau geprüft",
    ],
    cta: "Roadmap ansehen",
    href: LANDING_ROADMAP_HREF,
  },
  {
    step: "6",
    title: "Analytics einordnen",
    copy: "Roadmap-Auswertungen und Wachstumssignale transparent einordnen, ohne eine Vollsuite zu versprechen.",
    cardTitle: "Performance-Überblick",
    icon: "⌁",
    tone: "green",
    rows: [
      "Roadmap-Auswertung: In Kürze",
      "Wachstumssignale: Vorschau",
      "Antwortquote: Demo-Signal",
      "Insights für spätere Optimierung vorbereitet",
    ],
    cta: "Roadmap öffnen",
    href: LANDING_ROADMAP_HREF,
    showComingSoonMark: true,
  },
];

const sixStepBenefits = [
  {
    icon: "♙",
    title: "Stärkere Beziehungen",
    text: "Mehr Kontext. Mehr Relevanz. Mehr Vertrauen.",
    tone: "blue",
  },
  {
    icon: "◎",
    title: "Weniger Aufwand",
    text: "Bereite Routinen vor und fokussiere dich auf das Wesentliche.",
    tone: "green",
  },
  {
    icon: "↗",
    title: "Besseres Timing",
    text: "Follow-ups werden sichtbar, bevor Gespräche verloren gehen.",
    tone: "purple",
  },
  {
    icon: "◇",
    title: "Volle Kontrolle",
    text: "Transparente Daten, smarte Regeln und maximale Sicherheit.",
    tone: "cyan",
  },
];


const baseIntegrationChannels = [
  { platform: "instagram", title: "Instagram", text: "DM- und Profilkontext vorbereitet, noch keine Live-Anbindung.", status: "Beta / in Vorbereitung", tone: "pink" },
  { platform: "tiktok", title: "TikTok", text: "Kommentare und Handles als geprüfter Roadmap-Kanal.", status: "Coming Soon", tone: "purple" },
  { platform: "youtube", title: "YouTube", text: "Community- und Kommentar-Kontext für spätere Workflows.", status: "Roadmap", tone: "pink" },
  { platform: "facebook", title: "Facebook", text: "Seiten- und Profilkontakte vorbereitet, nicht produktiv angebunden.", status: "Beta / in Vorbereitung", tone: "blue" },
  { platform: "whatsapp", title: "WhatsApp", text: "Chat-Kontext für spätere Synchronisation vorbereitet.", status: "Coming Soon", tone: "green" },
  { platform: "telegram", title: "Telegram", text: "Community-Nachrichten als geplanter Kanal.", status: "Coming Soon", tone: "cyan" },
  { platform: "snapchat", title: "Snapchat", text: "Creator-Kontakte als späterer Social-Kanal.", status: "Roadmap", tone: "yellow" },
  { platform: "linkedin", title: "LinkedIn", text: "Business-Kontakte und Nachrichten für spätere Prüfung.", status: "Roadmap", tone: "blue" },
  { platform: "discord", title: "Discord", text: "Server- und Profilkontext vorbereitet, keine Live-Integration.", status: "Coming Soon", tone: "violet" },
  { platform: "x", title: "X / Twitter", text: "Handles und Aktivität für spätere Einordnung.", status: "Coming Soon", tone: "white" },
  { platform: "onlyfans", title: "OnlyFans", text: "Unverbindliche Phase-7-Prüfung ohne Anbindung oder Zusage.", status: "Phase 7 · Roadmap", tone: "blue" },
  { platform: "threads", title: "Threads", text: "Social-Kontext als Roadmap-Erweiterung.", status: "Roadmap", tone: "white" },
  { platform: "reddit", title: "Reddit", text: "Communities und Erwähnungen für spätere Pilotphasen.", status: "Roadmap", tone: "orange" },
  { platform: "email", title: "E-Mail", text: "Anfragen manuell bündeln; Synchronisation bleibt vorbereitet.", status: "Coming Soon", tone: "blue" },
  { platform: "website-chat", title: "Website-Chat", text: "Chat-Anfragen als vorbereiteter Eingangskanal.", status: "Beta / in Vorbereitung", tone: "cyan" },
  { platform: "webform", title: "Webformular", text: "Formularanfragen manuell übernehmen und zuordnen.", status: "Bereit", tone: "cyan" },
  { platform: "manual", title: "Manuell / CSV", text: "Kontakte importieren oder manuell pflegen.", status: "Bereit", tone: "green" },
  { platform: "twitch", title: "Twitch", text: "Streaming-Community als späterer Kanal.", status: "Roadmap", tone: "purple" },
  { platform: "pinterest", title: "Pinterest", text: "Content-Interaktionen für spätere Auswertung.", status: "Roadmap", tone: "pink" },
  { platform: "patreon", title: "Patreon / Memberships", text: "Mitgliedschaften als geplanter CRM-Kontext.", status: "Roadmap", tone: "orange" },
  { platform: "kofi", title: "Ko-fi", text: "Supporter-Kontext für spätere Workflows.", status: "Roadmap", tone: "cyan" },
  { platform: "buy-me-a-coffee", title: "Buy Me a Coffee", text: "Supporter-Profile als vorbereiteter Eingang.", status: "Roadmap", tone: "orange" },
  { platform: "substack", title: "Newsletter / Substack", text: "Newsletter-Reaktionen für spätere CRM-Sichten.", status: "Roadmap", tone: "orange" },
  { platform: "youtube-live-chat", title: "YouTube Live-Chat", text: "Live-Kommentare als späterer Pilot-Kanal.", status: "Roadmap", tone: "pink" },
  { platform: "discord-server", title: "Discord Server", text: "Server-Kontext bleibt klar vorbereitet.", status: "Coming Soon", tone: "violet" },
  { platform: "reddit-communities", title: "Reddit Communities", text: "Community-Kontext für spätere Pilotphasen.", status: "Roadmap", tone: "orange" },
  { platform: "google", title: "Google Business Profile", text: "Profil-Anfragen als geplanter Business-Kanal.", status: "Roadmap", tone: "blue" },
  { platform: "google-reviews", title: "Google Reviews", text: "Bewertungen für spätere Antwort-Workflows.", status: "Roadmap", tone: "green" },
  { platform: "review", title: "Reviews / Bewertungen", text: "Feedback-Quellen als ehrlicher Roadmap-Block.", status: "Roadmap", tone: "green" },
  { platform: "trustpilot", title: "Trustpilot", text: "Review-Kontext für spätere Bearbeitung.", status: "Roadmap", tone: "green" },
  { platform: "app-store", title: "App Store Reviews", text: "Store-Feedback als geplanter Eingang.", status: "Roadmap", tone: "blue" },
  { platform: "play-store", title: "Play Store Reviews", text: "App-Feedback als späterer Review-Kanal.", status: "Roadmap", tone: "green" },
  { platform: "shopify", title: "Shopify", text: "Shop-Kontakte als mögliche Commerce-Erweiterung.", status: "Roadmap", tone: "green" },
  { platform: "amazon", title: "Amazon", text: "Marketplace-Kontext für spätere Prüfung.", status: "Roadmap", tone: "orange" },
  { platform: "etsy", title: "Etsy", text: "Shop-Interaktionen als geplanter Kanal.", status: "Roadmap", tone: "orange" },
  { platform: "mercado-libre", title: "Mercado Libre", text: "Marketplace-Nachrichten für spätere Regionen.", status: "Roadmap", tone: "yellow" },
  { platform: "wechat", title: "WeChat", text: "Internationaler Messaging-Kanal auf der Roadmap.", status: "Roadmap", tone: "green" },
  { platform: "douyin", title: "Douyin", text: "Kurzvideo-Kanal für spätere Marktprüfung.", status: "Roadmap", tone: "purple" },
  { platform: "xiaohongshu-rednote", title: "Xiaohongshu / RedNote", text: "Community-Commerce-Kontext als Roadmap-Thema.", status: "Roadmap", tone: "pink" },
  { platform: "weibo", title: "Weibo", text: "Social-Profile für spätere internationale Piloten.", status: "Roadmap", tone: "orange" },
  { platform: "kuaishou", title: "Kuaishou", text: "Kurzvideo-Community für spätere Prüfung.", status: "Roadmap", tone: "purple" },
  { platform: "bilibili", title: "Bilibili", text: "Video-Community als internationaler Roadmap-Kanal.", status: "Roadmap", tone: "cyan" },
  { platform: "qq", title: "QQ", text: "Messaging-Kontext für spätere regionale Piloten.", status: "Roadmap", tone: "blue" },
  { platform: "line", title: "LINE", text: "Messaging-Kanal für spätere Marktprüfung.", status: "Roadmap", tone: "green" },
  { platform: "kakao", title: "KakaoTalk", text: "Messaging-Kontext als Roadmap-Erweiterung.", status: "Roadmap", tone: "yellow" },
  { platform: "viber", title: "Viber", text: "Messenger-Kontext für spätere Pilotphasen.", status: "Roadmap", tone: "purple" },
  { platform: "sharechat", title: "ShareChat", text: "Regionale Communities für spätere Validierung.", status: "Roadmap", tone: "orange" },
  { platform: "moj", title: "Moj", text: "Kurzvideo-Community als Roadmap-Kanal.", status: "Roadmap", tone: "pink" },
  { platform: "josh", title: "Josh", text: "Creator-Community für spätere Marktprüfung.", status: "Roadmap", tone: "pink" },
];

const phase3IntegrationPlatforms = new Set(["facebook", "instagram", "whatsapp"]);
const phase7IntegrationPlatforms = new Set(["tiktok", "x", "discord", "discord-server", "onlyfans"]);
const currentIntegrationPlatforms = new Set(["email", "website-chat", "webform", "manual"]);
const preparedPhase8IntegrationPlatforms = new Set(["telegram"]);

const integrationChannels = baseIntegrationChannels.map((channel) => {
  if (phase3IntegrationPlatforms.has(channel.platform) || currentIntegrationPlatforms.has(channel.platform)) {
    return channel;
  }
  if (phase7IntegrationPlatforms.has(channel.platform)) {
    return { ...channel, status: "Phase 7 · Roadmap" };
  }
  if (preparedPhase8IntegrationPlatforms.has(channel.platform)) {
    return { ...channel, status: "Phase 8 · vorbereitet / inaktiv" };
  }
  return {
    ...channel,
    status: "Phase 8 · noch nicht begonnen",
    text: `${channel.title} ist Phase 8 zugeordnet. Die Umsetzung hat noch nicht begonnen.`,
  };
});

const integrationMarqueeRows = [
  integrationChannels.filter((_, index) => index % 2 === 0),
  integrationChannels.filter((_, index) => index % 2 === 1),
];

const integrationSources = [
  { platform: "email", label: "E-Mail" },
  { platform: "discord", label: "Discord" },
  { platform: "whatsapp", label: "WhatsApp" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "instagram", label: "Instagram" },
  { platform: "x", label: "X" },
  { platform: "facebook", label: "Facebook" },
  { platform: "webform", label: "Webformulare" },
];

const integrationActions = [
  {
    icon: "♙",
    title: "Segmente",
    status: "Coming Soon",
    text: "Fans sinnvoll gruppieren.",
  },
  {
    icon: "☑",
    title: "Follow-ups",
    status: "Aktiv",
    text: "Nachfassaktionen vorbereiten.",
  },
  {
    icon: "📣",
    title: "Kampagnen",
    status: "Coming Soon",
    text: "Geprüfte Entwürfe planen.",
  },
  {
    icon: "⌁",
    title: "Analytics",
    status: "Coming Soon",
    text: "Wachstumssignale einordnen.",
  },
];

const integrationBenefits = [
  {
    icon: "✓",
    title: "Aktiv / verfügbar",
    text: "Manuelle Kontaktpflege, CSV-Import, KI-Antwortvorschläge, Kontaktwissen, Follow-ups und Demo.",
    tone: "blue",
  },
  {
    icon: "◷",
    title: "Beta / vorbereitet",
    text: "Facebook und Instagram werden nur als vorbereitete Beta-Workflows gezeigt; keine produktive Vollintegration.",
    tone: "purple",
  },
  {
    icon: "▣",
    title: "Coming Soon",
    text: "WhatsApp, TikTok, X, Discord, Kampagnen, Analytics/Reichweite sowie Rollen/Rechte bleiben Roadmap.",
    tone: "green",
  },
  {
    icon: "◇",
    title: "Manueller Workflow",
    text: "FanMind sendet nichts automatisch: KI bereitet vor, der Mensch prüft und sendet final selbst.",
    tone: "cyan",
  },
];


const responsiveBenefits = [
  {
    icon: "▯",
    title: "Mobil arbeitsfähig",
    text: "Kontakte, Follow-ups und Insights bleiben auch unterwegs übersichtlich erreichbar.",
    tone: "blue",
  },
  {
    icon: "ϟ",
    title: "Schnelle Reaktion unterwegs",
    text: "Prioritäten, Erinnerungen und nächste Schritte helfen dir, keine Chance zu verpassen.",
    tone: "purple",
  },
  {
    icon: "◎",
    title: "Konsistente Fan-Daten auf jedem Gerät",
    text: "Ein gemeinsamer Kontext für dich und dein Team – vom großen Screen bis zum Smartphone.",
    tone: "green",
  },
];




const privacyControlCards = [
  {
    number: "1",
    icon: "🛡",
    title: "DSGVO-orientierte Einwilligungen",
    text: "Einwilligungen und Opt-outs sollen transparent dokumentiert und für dein Team nachvollziehbar bleiben.",
    label: "Rechtssicher gedacht",
    status: "Geplant",
    tone: "blue",
  },
  {
    number: "2",
    icon: "👥",
    title: "Rollen & Rechte",
    text: "Team-Zugriffe werden bewusst geplant – mit klaren Zuständigkeiten statt ungeprüfter Vollzugriffe.",
    label: "Roadmap: Team-Rechte",
    status: "Roadmap",
    tone: "purple",
  },
  {
    number: "3",
    icon: "▤",
    title: "Audit-Log",
    text: "Änderungen, Freigaben und sensible Aktionen sind als nachvollziehbare Protokollierung vorgesehen.",
    label: "Roadmap: Protokolle",
    status: "Roadmap",
    tone: "green",
  },
  {
    number: "4",
    icon: "◇",
    title: "Do-not-push-Regeln",
    text: "Präferenzen und Sperrlisten werden respektiert – für vertrauensvolle, bewusste Kommunikation.",
    label: "Roadmap: Präferenzen",
    status: "Roadmap",
    tone: "amber",
  },
  {
    number: "5",
    icon: "☑",
    title: "Manuelle Freigabe vor Versand",
    text: "KI-Vorschläge bleiben Vorschläge. Dein Team prüft bewusst, bevor etwas an Fans geht.",
    label: "Kontrolle vor Versand",
    status: "Geplant",
    tone: "violet",
  },
  {
    number: "6",
    icon: "✦",
    title: "EU-Datenfokus",
    text: "Datenschutz, Transparenz und europäische Anforderungen werden als Produktprinzip mitgedacht.",
    label: "Sicherheitsfokus EU",
    status: "Geplant",
    tone: "blue",
  },
];

const privacyControlBenefits = [
  {
    icon: "☑",
    title: "Keine automatischen Nachrichten ohne Freigabe",
    text: "Jede KI-Antwort bleibt ein geprüfter Entwurf.",
    tone: "blue",
  },
  {
    icon: "▤",
    title: "Transparente Nachvollziehbarkeit",
    text: "Wichtige Schritte werden klar sichtbar eingeordnet.",
    tone: "purple",
  },
  {
    icon: "♙",
    title: "Sichere Workflows für Teams",
    text: "Klare Prozesse, definierte Regeln und bewusste Zuständigkeiten.",
    tone: "green",
  },
];


const faqHighlights = [
  {
    icon: "▣",
    title: "Alles an einem Ort",
    text: "E-Mails, Formulare und Gesprächsnotizen werden zentral gebündelt.",
    accent: "Weniger Chaos, mehr Überblick",
    tone: "purple",
  },
  {
    icon: "🧠",
    title: "KI, die versteht",
    text: "FanMind bereitet passende Vorschläge vor – dein Team prüft und entscheidet.",
    accent: "Intelligent & kontextbasiert",
    tone: "green",
  },
  {
    icon: "🛡",
    title: "Sicher & DSGVO-orientiert",
    text: "Datenschutz, Transparenz und bewusste Freigaben stehen im Fokus.",
    accent: "Vertrauen & Transparenz",
    tone: "blue",
  },
  {
    icon: "▥",
    title: "Messbar mehr Wirkung",
    text: "Kontakte, Follow-ups und Roadmap-Signale helfen dir, Wirkung besser einzuordnen.",
    accent: "Mehr Impact, weniger Aufwand",
    tone: "violet",
  },
];

const faqs = [
  {
    number: "1",
    question: "Für wen ist FanMind gedacht?",
    answer:
      "FanMind ist für Creator, Clubs, Agenturen und Brands gedacht, die Fan-Kommunikation professionell verwalten und strukturieren wollen – vom produktiven Start bis zum wachsenden Team.",
    open: true,
  },
  {
    number: "2",
    question: "Kann FanMind E-Mail, WhatsApp und Chat verbinden?",
    answer:
      "E-Mail, Kontakte, CSV-Import und zentrale Gesprächsnotizen stehen aktuell im Fokus. Weitere Kanäle wie WhatsApp, Social DMs und Community-Chats sind als Roadmap transparent markiert.",
  },
  {
    number: "3",
    question: "Sendet die KI automatisch Nachrichten?",
    answer:
      "Nein. FanMind bereitet KI-Vorschläge vor, aber dein Team prüft Inhalte bewusst und gibt Kommunikation selbst frei. Es gibt keinen ungeprüften automatischen Versand.",
  },
  {
    number: "4",
    question: "Wie schützt FanMind meine Daten?",
    answer:
      "FanMind ist mit Datenschutz-Fokus, klaren Freigaben und EU-orientierten Produktprinzipien konzipiert. Sensible Workflows werden bewusst transparent gehalten.",
  },
  {
    number: "5",
    question: "Kann ich mehrere Profile oder Kunden verwalten?",
    answer:
      "Mehrere Profile und Kunden sind vor allem für Growth- und Agency-Workflows vorgesehen. In einer Beratung klären wir gemeinsam, welche Struktur für dein Team sinnvoll ist.",
  },
  {
    number: "6",
    question: "Kann ich bestehende Kontakte importieren?",
    answer:
      "Ja, Kontakt-Import per CSV ist Teil des Produktfokus. Feld-Zuordnung, Validierung und größere Import-Workflows werden schrittweise ausgebaut.",
  },
  {
    number: "7",
    question: "Gibt es Zugang oder eine Demo?",
    answer:
      "Ja. Du kannst eine Demo oder Zugang anfragen, damit wir FanMind mit deinem konkreten Use Case und deinen Fan-Prozessen einordnen.",
  },
];

const faqContacts = [
  {
    icon: "✉",
    title: "Beratung anfragen",
    text: "Schreib uns eine Nachricht zu deinem Use Case und zum passenden FanMind-Einstieg.",
    cta: "Beratung anfragen",
    href: "mailto:kontakt@fanmind.ch?subject=Beratung%20anfragen",
    tone: "blue",
  },
  {
    icon: "▶",
    title: "Kostenlos testen",
    text: "Sieh dir die Produktvorschau an und starte mit einem kostenlosen Demo-Zugang.",
    cta: "Kostenlos testen",
    href: "/login",
    tone: "purple",
  },
  {
    icon: "ϟ",
    title: "Login für bestehende Teams",
    text: "Bestehende Nutzer gelangen direkt in ihren FanMind-Workspace.",
    cta: "Login",
    href: "/login",
    tone: "green",
  },
];


const landingFooterColumns = [
  {
    title: "Produkt",
    links: [
      { label: "Produkt", href: "#produkt-showcase" },
      { label: "Workflow", href: "#conversion" },
      { label: "Funktionen", href: "#features" },
      { label: "Preise", href: "#preise" },
      { label: "Roadmap", href: LANDING_ROADMAP_HREF },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { label: "Impressum", href: "/impressum" },
      { label: "Datenschutz", href: "/datenschutz" },
      { label: "AGB", href: "/agb" },
      { label: "Zahlungsbedingungen", href: "/zahlungsbedingungen" },
      { label: "Referral-Bedingungen", href: "/referral-bedingungen" },
    ],
  },
  {
    title: "Zugang",
    links: [
      { label: "Login", href: "/login" },
      { label: "Registrieren", href: "/register" },
      { label: "Kostenlos testen", href: "/login" },
      { label: "Beratung anfragen", href: "#kontakt" },
      { label: "Hilfe & Support", href: "/support" },
    ],
  },
];


const pricingPlans = [
  {
    icon: "♙",
    name: "Starter Flex",
    eyebrow: "Monatlich kündbar",
    audience: "Für kleine Teams, die produktiv starten und flexibel bleiben möchten.",
    pricePrefix: "",
    price: "990 € Setup + 312 €/Monat",
    cadence: "jederzeit zum Ende des bezahlten Monats kündbar",
    cta: "Registrieren",
    href: "/register?plan=starter&option=starter_paid_setup",
    tone: "blue",
    featured: false,
    status: "Aktiv",
    features: ["Ein produktiver Workspace", "Kontakte/Fans und manuelle Kontaktpflege", "CSV-Import, Notizen und Kontaktwissen", "Follow-ups & Aufgaben inklusive /followups", "KI Standard enthalten", "KI Plus +100 €/Monat · KI Ultra +200 €/Monat", "Kein automatischer Versand"],
  },
  {
    icon: "◎",
    name: "Starter 12 Monate",
    eyebrow: "Setup inklusive",
    audience: "Für Teams, die FanMind langfristiger einführen und die Setup-Gebühr sparen möchten.",
    pricePrefix: "",
    price: "0 € Setup + 312 €/Monat",
    cadence: "12 Monate Mindestlaufzeit · danach monatliche Verlängerung",
    cta: "Registrieren",
    href: "/register?plan=starter&option=starter_no_setup_commitment",
    tone: "green",
    featured: true,
    status: "Aktiv",
    features: ["Ein produktiver Workspace", "Setup ohne separate Setup-Gebühr", "Kontakte/Fans, CSV-Import und Kontaktwissen", "Follow-ups & Aufgaben inklusive /followups", "KI Standard enthalten", "KI Plus +100 €/Monat · KI Ultra +200 €/Monat", "Externe Integrationen nur Beta/Roadmap"],
  },
  {
    icon: "↗",
    name: "Growth",
    eyebrow: "Coming Soon",
    audience: "Roadmap-Paket für wachsende Teams, die mehrere Profile und mehr Struktur vorbereiten möchten.",
    pricePrefix: "",
    price: "Coming Soon",
    cadence: "Coming Soon · noch nicht produktiv buchbar",
    cta: "Beratung anfragen",
    href: "#kontakt",
    tone: "blue",
    featured: false,
    status: "Coming Soon",
    features: ["Mehrere Profile als Ausbaupfad geplant", "Basis-Segmente und Listen als Roadmap", "Reichweiten- und Performance-Signale als Roadmap", "Kein automatischer Versand", "Kundenfeedback bestimmt den Ausbau", "Noch nicht kaufbar dargestellt"],
  },
  {
    icon: "▥",
    name: "Agency",
    eyebrow: "Coming Soon",
    audience: "Roadmap für Agenturen mit mehreren Kunden-Workspaces und abgestimmten Freigaben.",
    pricePrefix: "",
    price: "Auf Anfrage",
    cadence: "Coming Soon · noch nicht produktiv buchbar",
    cta: "Beratung anfragen",
    href: "#kontakt",
    tone: "purple",
    featured: false,
    status: "Coming Soon",
    features: ["Multi-Workspace / Agency-Ansichten geplant", "Team-Rollen und Rechte als Roadmap", "Kampagnen nur mit manueller Freigabe geplant", "Analytics & Reichweite nicht als Live-Suite", "Kundenfeedback bestimmt den Ausbau", "Noch nicht kaufbar dargestellt"],
  },
  {
    icon: "◇",
    name: "Enterprise / Custom",
    eyebrow: "Coming Soon",
    audience: "Für spätere individuelle Anforderungen, Governance und größere interne Abstimmungen.",
    pricePrefix: "",
    price: "Auf Anfrage",
    cadence: "Coming Soon · individuelle Prüfung erforderlich",
    cta: "Kontakt aufnehmen",
    href: "#kontakt",
    tone: "green",
    featured: false,
    status: "Coming Soon",
    features: ["Individuelle Workflows später geplant", "Governance und Freigabeprozesse als Roadmap", "Keine Enterprise-Rollen in der aktuellen Version aktiv", "Keine automatische Sendefunktion", "Technische und rechtliche Prüfung vor Zusage", "Keine Fake-Live-Kennzahlen"],
  },
];

const pricingProofs = [
  {
    icon: "♙",
    title: "Mensch prüft & sendet selbst",
    text: "Du behältst die Kontrolle – FanMind unterstützt dich.",
    tone: "blue",
  },
  {
    icon: "✈",
    title: "Keine automatische Sendefunktion",
    text: "FanMind bereitet vor. Du entscheidest, kopierst und sendest selbst.",
    tone: "purple",
  },
  {
    icon: "↗",
    title: "Keine Bankdaten in FanMind",
    text: "Zahlungen laufen sicher über den Zahlungsanbieter; FanMind speichert keine Bankdaten.",
    tone: "green",
  },
  {
    icon: "◇",
    title: "KI bleibt Assistenz",
    text: "Antwortvorschläge sind Hilfen, keine Pflichtantworten und kein Autopilot.",
    tone: "cyan",
  },
  {
    icon: "⚑",
    title: "Roadmap klar gekennzeichnet",
    text: "Geplante Funktionen sind transparent markiert.",
    tone: "blue",
  },
  {
    icon: "▣",
    title: "Sicherer Zahlungsprozess",
    text: "Starter-Nettopreise, Laufzeiten sowie Steuer- oder Reverse-Charge-Behandlung werden transparent dargestellt.",
    tone: "green",
  },
];

function Logo({ compact = false, language = "de" }: { compact?: boolean; language?: FanMindLanguage }) {
  return <FanMindLogo compact={compact} className={styles.logo} href={landingPath(language)} />;
}


function isComingSoonStatus(status?: string) {
  return Boolean(status && ["Roadmap", "In Kürze", "Coming Soon", "Beta / in Vorbereitung", "Vorschau", "Preview", "Geplant", "Planned"].includes(status));
}

function isReadyStatus(status?: string) {
  return Boolean(status && ["Bereit", "Verfügbar", "Aktiv", "Active"].includes(status));
}
function LandingHeader({
  language,
  loginHref,
  localizedNavItems,
  registerHref,
  switchBase,
  t,
}: {
  language: FanMindLanguage;
  loginHref: string;
  localizedNavItems: Array<{ label: string; href: string }>;
  registerHref: string;
  switchBase: string;
  t: ReturnType<typeof createFanMindTranslator>;
}) {
  return (
    <div className={styles.landingHeaderRoot} data-landing-header="root">
      <header className={styles.header}>
        <Logo language={language} />
        <nav className={styles.nav} aria-label={language === "en" ? "Main navigation" : "Hauptnavigation"}>
          {localizedNavItems.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <div className={styles.languageSwitch} aria-label={language === "en" ? "Language selection" : "Sprachauswahl"}>
            <a className={language === "de" ? styles.languageActive : undefined} href={switchBase} aria-current={language === "de" ? "true" : undefined}>DE</a>
            <span>|</span>
            <a className={language === "en" ? styles.languageActive : undefined} href={`${switchBase}?lang=en`} aria-current={language === "en" ? "true" : undefined}>EN</a>
          </div>
          <a className={styles.loginButton} href={loginHref}>
            Login
          </a>
          <a className={styles.accessButton} href={registerHref}>
            {t("Registrieren")} <span>→</span>
          </a>
        </div>
      </header>
    </div>
  );
}

type LandingV2Props = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function LandingV2({ searchParams }: LandingV2Props) {
  const params = await searchParams;
  const language = getFanMindLanguage(params?.lang);
  const t = createFanMindTranslator(language);
  const loginHref = localizedPath("/login", language);
  const registerHref = localizedPath("/register", language);
  const roadmapHref = landingPath(language, "#roadmap");
  const switchBase = "/";
  const localizedNavItems = navItems.map((item) => ({ ...item, label: t(item.label), href: item.href === LANDING_ROADMAP_HREF ? roadmapHref : item.href }));
  const localizedFeatures = localizeFanMindValue(features, t);
  const localizedProblemCards = localizeFanMindValue(problemCards, t);
  const localizedSolutionBenefits = localizeFanMindValue(solutionBenefits, t);
  const localizedFunctionCards = localizeFanMindValue(functionCards, t).map((card) => ({ ...card, href: card.href === LANDING_ROADMAP_HREF ? roadmapHref : card.href }));
  const localizedSixStepCards = localizeFanMindValue(sixStepCards, t).map((card) => ({ ...card, href: card.href === LANDING_ROADMAP_HREF ? roadmapHref : card.href }));
  const localizedSixStepBenefits = localizeFanMindValue(sixStepBenefits, t);
  const localizedIntegrationMarqueeRows = integrationMarqueeRows.map((row) =>
    row.map((channel) => {
      const localizedChannel = localizeFanMindValue(channel, t);

      if (
        !phase3IntegrationPlatforms.has(channel.platform) &&
        !phase7IntegrationPlatforms.has(channel.platform) &&
        !currentIntegrationPlatforms.has(channel.platform) &&
        !preparedPhase8IntegrationPlatforms.has(channel.platform)
      ) {
        return {
          ...localizedChannel,
          status: language === "en" ? "Phase 8 · not started" : "Phase 8 · noch nicht begonnen",
          text:
            language === "en"
              ? `${localizedChannel.title} is assigned to Phase 8. Implementation has not started.`
              : `${localizedChannel.title} ist Phase 8 zugeordnet. Die Umsetzung hat noch nicht begonnen.`,
        };
      }

      return localizedChannel;
    }),
  );
  const localizedIntegrationSources = localizeFanMindValue(integrationSources, t);
  const localizedIntegrationActions = localizeFanMindValue(integrationActions, t);
  const localizedIntegrationBenefits = localizeFanMindValue(integrationBenefits, t);
  const localizedResponsiveBenefits = localizeFanMindValue(responsiveBenefits, t);
  const localizedPrivacyControlCards = localizeFanMindValue(privacyControlCards, t);
  const localizedPrivacyControlBenefits = localizeFanMindValue(privacyControlBenefits, t);
  const localizedFaqHighlights = localizeFanMindValue(faqHighlights, t);
  const localizedFaqs = localizeFanMindValue(faqs, t);
  const localizedFaqContacts = localizeFanMindValue(faqContacts, t).map((contact) => ({ ...contact, href: contact.href === "/login" ? loginHref : contact.href }));
  const localizedLandingFooterColumns = localizeFanMindValue(landingFooterColumns, t).map((column) => ({
    ...column,
    links: column.links.map((link) => ({
      ...link,
      href: link.href === LANDING_ROADMAP_HREF ? roadmapHref : link.href === "/login" ? loginHref : link.href === "/register" ? registerHref : link.href,
    })),
  }));
  const localizedPricingPlans = localizeFanMindValue(pricingPlans, t).map((plan) => ({ ...plan, href: plan.href.startsWith("/register") ? localizedPath("/register", language, plan.href.includes("?") ? plan.href.slice(plan.href.indexOf("?")) : "") : plan.href }));
  const localizedPricingProofs = localizeFanMindValue(pricingProofs, t);
  const localizedRoadmapPhases = localizeFanMindValue(roadmapPhases, t);
  const localizedRoadmapNotes = localizeFanMindValue(roadmapNotes, t);

  return (
    <>
      <LandingHeader
        language={language}
        loginHref={loginHref}
        localizedNavItems={localizedNavItems}
        registerHref={registerHref}
        switchBase={switchBase}
        t={t}
      />

      <main id="top" className={styles.page}>
        <div className={styles.backgroundGlow} aria-hidden="true" />
        <section className={styles.heroSection} aria-label="Startbereich FanMind">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <a className={styles.badge} href="#produkt-showcase">
              <span>{t("NEU")}</span> {t("Die intelligente Fan-Management Plattform")}
            </a>
            <h1>
              {t("Dein KI-gestütztes")} <span>{t("Fan-CRM für Nachrichten, Erinnerungen")}</span> {t("und")} {" "}
              <span>Follow-ups.</span>
            </h1>
            <p>{t("FanMind bündelt Kontakte, Gesprächskontext und KI-Antwortvorschläge in einem manuellen Workflow. Du prüfst, kopierst und sendest selbst – ohne automatische Sendefunktion.")}</p>
          </div>

          <figure
            id="screens"
            className={styles.dashboardWrap}
            aria-label="FanMind Dashboard-Produktvorschau"
          >
            <Image
              className={styles.dashboardImage}
              src="/assets/Landingpage-dashboard.png"
              alt={t("FanMind Dashboard mit Kontaktübersicht, Kennzahlen und KI-gestütztem CRM-Workflow")}
              width={2245}
              height={1231}
              priority
              sizes="(max-width: 980px) 100vw, 48vw"
            />
          </figure>
        </section>

        <section id="features" className={styles.heroFeatureGrid}>
          {localizedFeatures.map((feature) => {
            const showComingSoonMark =
              isComingSoonStatus(feature.status) ||
              ("showComingSoonMark" in feature && feature.showComingSoonMark);

            return (
              <article
                className={`${styles.heroFeatureCard} ${showComingSoonMark ? styles.cardWithComingSoon : ""}`}
                key={feature.title}
                data-tone={feature.tone}
              >
                <div><FanMindFunctionIcon name={resolveFanMindFunctionIcon(feature.icon, feature.title)} /></div>
                <h3>{feature.title}</h3>
                {statusVariantFromLabel(feature.status) ? (
                  <FeatureStatusLabel variant={statusVariantFromLabel(feature.status)!}>{feature.status}</FeatureStatusLabel>
                ) : null}
                <p>{feature.text}</p>
                {showComingSoonMark ? <ComingSoonMark size="small" className={styles.comingSoonImage} /> : null}
              </article>
            );
          })}
        </section>

        <section id="early-access" className={styles.heroBottomCta}>
          <div className={styles.gift}>▣</div>
          <div>
            <h2>{t("Starte jetzt smartere Fan-Beziehungen.")}</h2>
            <p>
              {t("Kostenlos testen · 1 Stunde Demo-Zugang")} <span>•</span> {t("Keine Kreditkarte erforderlich")} {" "}
              <span>•</span> {t("Keine Bindung")}
            </p>
          </div>
          <a
            className={styles.accessButton}
            href={loginHref}
          >
            {t("Kostenlos testen")} <span>→</span>
          </a>
          <a
            className={styles.demoSecondary}
            href="#kontakt"
          >
            <span>♙</span> {t("Starter wählen")}
          </a>
        </section>

      </section>

      <section
        id="problem"
        className={styles.problemSolutionSection}
        aria-labelledby="problem-solution-title"
      >
        <div className={styles.problemOrbit} aria-hidden="true" />
        <div className={styles.problemHeader}>
          <div className={styles.problemBadge}>
            <span>!</span> {t("DAS PROBLEM HEUTE")}
          </div>
          <h2 id="problem-solution-title">
            {t("Fan-Kommunikation ist heute")} <span>{t("verstreut, unübersichtlich")}</span>{" "}
            {t("und")} <em>{t("schwer messbar.")}</em>
          </h2>
          <p>{t("Viele Kanäle, wenig Kontext und manuelle Prozesse verhindern echte Fan-Nähe, schnelle Antworten und nachhaltiges Wachstum.")}</p>
        </div>

        <div className={styles.problemSolutionGrid}>
          <div className={styles.problemCards}>
            {localizedProblemCards.map((card) => (
              <article className={styles.problemCard} key={card.title}>
                <div className={styles.problemIcon}><FanMindFunctionIcon name={resolveFanMindFunctionIcon(card.icon, card.title)} /></div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className={styles.problemMiniAlert}>
                  <span>△</span>
                  {card.detail}
                </div>
              </article>
            ))}
          </div>

          <article className={styles.solutionCard}>
            <div className={styles.solutionBadge}>
              <span>✓</span> {t("DIE LÖSUNG")}
            </div>
            <h3>
              <span>FanMind</span> {t("verbindet Kontakte, Kontaktwissen, KI, Follow-ups und Roadmap in")} <em>{t("einem System.")}</em>
            </h3>
            <p>{t("Alle Informationen, Interaktionen und Abläufe laufen zusammen – für echte Fan-Beziehungen, die skalieren. KI-Vorschläge bleiben Vorschläge: Der Mensch prüft und gibt frei.")}</p>
            <div className={styles.solutionBenefits}>
              {localizedSolutionBenefits.map((benefit) => (
                <div key={benefit.title}>
                  <span><FanMindFunctionIcon name={resolveFanMindFunctionIcon(benefit.icon, benefit.title)} /></span>
                  <strong>{benefit.title}</strong>
                  <small>{benefit.text}</small>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className={styles.solutionFlow}>
          {localizedFunctionCards.map((card) => {
            const showComingSoonMark =
    isComingSoonStatus(card.status) ||
    ("showComingSoonMark" in card && card.showComingSoonMark === true);

            return (
              <article
                className={`${styles.solutionFunctionCard} ${showComingSoonMark ? styles.cardWithComingSoon : ""}`}
                data-tone={card.tone}
                key={card.title}
              >
                <div className={styles.functionTitle}>
                  <span><FanMindFunctionIcon name={resolveFanMindFunctionIcon(card.icon, card.title)} /></span>
                  <div>
                    <h3>{card.title}</h3>
                    {card.hideStatusLabel ? null : statusVariantFromLabel(card.status) ? (
                      <FeatureStatusLabel variant={statusVariantFromLabel(card.status)!}>{card.status}</FeatureStatusLabel>
                    ) : null}
                    <p>{card.text}</p>
                  </div>
                </div>
                <div className={styles.functionPreview}>{card.body}</div>
                <a href={card.href}>
                  {card.cta} <span>→</span>
                </a>
                {showComingSoonMark ? <ComingSoonMark size="medium" className={styles.comingSoonImage} /> : null}
              </article>
            );
          })}
        </div>

        <div className={styles.problemCtas}>
          <a className={styles.demoButton} href={loginHref}>
            <span>▶</span> {t("Kostenlos testen")}
          </a>
          <a className={styles.outlineButton} href="#kontakt">
            <span>♙</span> {t("Starter wählen")}
          </a>
        </div>
      </section>

      <ProductShowcaseSection language={language} />

      <section
        id="six-steps"
        className={styles.sixStepsSection}
        aria-labelledby="six-steps-title"
      >
        <div className={styles.sixStepsConstellationLeft} aria-hidden="true" />
        <div className={styles.sixStepsConstellationRight} aria-hidden="true" />
        <div className={styles.sixStepsHeader}>
          <div className={styles.sixStepsBadge}>
            <Logo compact language={language} />
            <span>{t("FanMind in 6 Schritten")}</span>
          </div>
          <h2 id="six-steps-title">
            {t("Von der ersten Anfrage bis zum geprüften")} <span>Follow-up.</span>
          </h2>
          <p>{t("FanMind verbindet Kontakte, KI und Aktionen in einem System – damit du Beziehungen aufbaust, rechtzeitig reagierst und nächste Schritte nachvollziehbar vorbereitest.")}</p>
        </div>

        <div className={styles.processTrack} aria-label="FanMind Prozesslinie">
          {localizedSixStepCards.map((step, index) => (
            <article
              className={`${styles.processStep} ${("showComingSoonMark" in step && step.showComingSoonMark === true) || isComingSoonStatus(step.badge) ? styles.cardWithComingSoon : ""}`}
              data-tone={step.tone}
              key={step.title}
            >
              <div className={styles.stepNodeWrap}>
                <span className={styles.stepNode}>{step.step}</span>
              </div>
              <h3>
                {step.step}. {step.title}
              </h3>
              <p>{step.copy}</p>
              <div className={styles.stepExampleCard}>
                <div className={styles.stepCardTitle}>
                  <span><FanMindFunctionIcon name={resolveFanMindFunctionIcon(step.icon, step.title)} /></span>
                  <strong>{step.cardTitle}</strong>
                  {step.badge && !("showComingSoonMark" in step && step.showComingSoonMark === true) && (
                    <FeatureStatusLabel variant={statusVariantFromLabel(step.badge) ?? "preview"}>{step.badge}</FeatureStatusLabel>
                  )}
                </div>
                <div className={styles.stepRows}>
                  {step.rows.map((row, rowIndex) => (
                    <div className={styles.stepRow} key={row}>
                      <i aria-hidden="true">
                        {rowIndex === step.rows.length - 1 ? "✓" : ""}
                      </i>
                      <span>{row}</span>
                      {index === 2 && rowIndex < 3 && (
                        <button type="button">{t("Auswählen")}</button>
                      )}
                    </div>
                  ))}
                </div>
                <a href={step.href}>
                  {step.cta}
                  <span>→</span>
                </a>
              </div>
              {("showComingSoonMark" in step && step.showComingSoonMark === true) || isComingSoonStatus(step.badge) ? <ComingSoonMark size="medium" className={styles.comingSoonImage} /> : null}
            </article>
          ))}
        </div>

        <div className={styles.sixStepsStatement}>
          <span>★</span>
          <strong>{t("Ein System für Beziehungen, Aktionen und Ergebnisse.")}</strong>
        </div>

        <div className={styles.sixStepsBenefits}>
          {localizedSixStepBenefits.map((benefit) => (
            <article data-tone={benefit.tone} key={benefit.title}>
              <span>{benefit.icon}</span>
              <div>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="conversion"
        className={styles.sandraUseCaseSection}
        aria-labelledby="sandra-use-case-title"
      >
        <div className={styles.sandraUseCaseHero}>
          <div className={styles.sandraUseCaseHeader}>
            <span className={styles.sandraUseCaseBadge}>{t("Demo-Workflow mit Beispieldaten")}</span>
            <h2 id="sandra-use-case-title">
              {t("Aus Anfrage wird")} <span>{t("ein nächster Schritt.")}</span>
            </h2>
            <p>{t("Produktvorschau mit Beispieldaten: FanMind zeigt, wie Kontakte, Kontaktwissen, KI-Vorschläge und manuelle Follow-ups zusammenarbeiten.")}</p>
          </div>

          <aside
            className={styles.sandraProfileSummary}
            aria-label="Sandra M. Profil und zentrale FanMind Vorteile"
          >
            <div className={styles.sandraProfileIntro}>
              <span className={styles.sandraAvatar}>SM</span>
              <div>
                <strong>Sandra M.</strong>
                <div className={styles.sandraSignalStrip}>
                  <span>{t("Käuferin")}</span>
                  <span>{t("VIP interessiert")}</span>
                </div>
                <p>
                  Mia Active Club <i aria-hidden="true">•</i> Fan Score 92
                </p>
              </div>
            </div>
            <div className={styles.sandraSummaryPillars}>
              <article>
                <span>🧠</span>
                <strong>{t("KI versteht Kontext")}</strong>
                <p>{t("Relevante Insights in Echtzeit.")}</p>
              </article>
              <article>
                <span>✧</span>
                <strong>{t("Next-Best-Action")}</strong>
                <p>{t("Die passende Aktion zur richtigen Zeit.")}</p>
              </article>
              <article>
                <span>↗</span>
                <strong>{t("Besseres Timing")}</strong>
                <p>{t("Bessere Erlebnisse, stärkere Bindung.")}</p>
              </article>
            </div>
          </aside>
        </div>

        <div
          className={styles.sandraUseCaseFlow}
          aria-label="FanMind Demo-Fläche für Sandra M. mit Kontaktwissen, KI-Antwortvorschlägen und Follow-up-Planung"
        >
          <article className={styles.sandraFlowStep}>
            <div className={styles.sandraStepNode}>1</div>
            <h3>{t("Sandra fragt nach dem Sommer-Event")}</h3>
            <div className={styles.sandraFlowCard}>
              <div className={styles.sandraMiniProfile}>
                <span>SM</span>
                <strong>Sandra M.</strong>
                <em>09:21</em>
              </div>
              <div className={styles.sandraChatWindow}>
                <div className={styles.sandraMessageInbound}>
                  {t("Hi liebes Team! Wann startet der Vorverkauf für das Sommer-Event?")}
                </div>
                <div className={styles.sandraMessageOutbound}>
                  {t("Hallo Sandra! Der Vorverkauf beginnt am 18. Mai um 10:00 Uhr. 🙂")}
                </div>
              </div>
              <div className={styles.sandraCardMeta}>
                <span>{t("▱ Kanal: Chat")}</span>
                <span>{t("◷ Heute, 09:21")}</span>
              </div>
            </div>
            <p>{t("Sandra zeigt Interesse am Sommer-Event. Die Nachricht landet im zentralen Posteingang.")}</p>
          </article>

          <article className={styles.sandraFlowStep}>
            <div className={styles.sandraStepNode}>2</div>
            <h3>{t("FanMind erkennt den Kontext")}</h3>
            <div className={styles.sandraFlowCard}>
              <div className={styles.sandraMiniProfile}>
                <span>SM</span>
                <strong>Sandra M.</strong>
                <em>Mia Active Club</em>
              </div>
              <div className={styles.sandraKnowledgeList}>
                <div>
                  <span>{t("Status")}</span>
                  <strong>{t("Käuferin")}</strong>
                </div>
                <div>
                  <span>{t("Interesse")}</span>
                  <strong>{t("VIP interessiert")}</strong>
                </div>
                <div>
                  <span>Fan Score</span>
                  <strong>92</strong>
                </div>
                <div>
                  <span>{t("Historie")}</span>
                  <strong>{t("48 Interaktionen")}</strong>
                </div>
                <div>
                  <span>{t("Letzter Kontakt")}</span>
                  <strong>{t("Heute, 09:21")}</strong>
                </div>
                <div>
                  <span>{t("Positive Signale")}</span>
                  <strong>{t("hohes Interesse")}</strong>
                </div>
              </div>
            </div>
            <p>{t("FanMind vereint Profil, Historie und Verhalten zu einem klaren Bild – in Sekunden.")}</p>
          </article>

          <article className={styles.sandraFlowStep}>
            <div className={styles.sandraStepNode}>3</div>
            <h3>{t("KI schlägt die passende Antwort vor")}</h3>
            <div className={styles.sandraFlowCard}>
              <div className={styles.sandraAiBox}>
                <div className={styles.sandraAiHeader}>
                  <span>✧</span>
                  <strong>{t("KI-Antwortvorschlag")}</strong>
                  <em>{t("Beta")}</em>
                </div>
                <p>{t("Ja, als Mitglied bekommst du Early-Bird-Zugang und 10 % Rabatt. Wenn du möchtest, sende ich dir gleich alle Details zum Start.")}</p>
                <div>
                  <button type="button">{t("kurzer")}</button>
                  <button type="button">{t("freundlicher")}</button>
                  <button type="button">{t("mit Kontaktwissen")}</button>
                </div>
              </div>
              <div className={styles.sandraReasonList}>
                <strong>{t("Gründe")}</strong>
                <span>{t("hohes Kaufinteresse")}</span>
                <span>{t("Early-Bird relevant")}</span>
                <span>{t("Mitglied & VIP-Potenzial")}</span>
              </div>
            </div>
            <p>{t("Unsere KI formuliert die beste Antwort – persönlich, relevant und auf Sandra abgestimmt.")}</p>
          </article>

          <article className={styles.sandraFlowStep}>
            <div className={styles.sandraStepNode}>4</div>
            <h3>{t("Nächste beste Aktion vorgeschlagen")}</h3>
            <div className={styles.sandraFlowCard}>
              <div className={styles.sandraActionPanel}>
                <div>
                  <strong>{t("VIP-Infos + Friend-Ticket senden")}</strong>
                  <span>{t("Empfohlen")}</span>
                </div>
                <ul>
                  <li>{t("hohes Kaufinteresse")}</li>
                  <li>{t("positiver Verlauf")}</li>
                  <li>{t("Early-Bird relevant")}</li>
                  <li>{t("hohe Relevanz")}</li>
                </ul>
              </div>
              <div className={styles.sandraFollowUpBox}>
                <strong>{t("Follow-up planen")}</strong>
                <span>{t("Erinnerung senden")} <em>{t("Morgen, 09:00")}</em></span>
                <span>{t("Segmentzuweisung prüfen")} <em>{t("Morgen, 12:00")}</em></span>
              </div>
            </div>
            <p>{t("FanMind empfiehlt die optimale Aktion und plant ein Follow-up – zur manuellen Freigabe.")}</p>
          </article>

          <article className={styles.sandraFlowStep}>
            <div className={styles.sandraStepNode}>5</div>
            <h3>{t("Demo-Ergebnis: klarer nächster Schritt, besseres Timing")}</h3>
            <div className={`${styles.sandraFlowCard} ${styles.sandraResultCard}`}>
              <div className={styles.sandraConversionPanel}>
                <strong>{t("Demo-Signal")}</strong>
                <span>9,4 %</span>
                <em>{t("↑ +1,2 % vs. letzter Zeitraum")}</em>
                <div aria-hidden="true" />
              </div>
              <div className={styles.sandraMetricPair}>
                <div>
                  <strong>{t("Öffnungsrate")}</strong>
                  <span>38 %</span>
                  <em>↑ +4,2 %</em>
                </div>
                <div>
                  <strong>{t("Antwortquote")}</strong>
                  <span>34,8 %</span>
                  <em>↑ +2,1 %</em>
                </div>
              </div>
            </div>
            <p>{t("Beispieldaten zeigen den manuellen Workflow: Antwort vorbereiten, Follow-up planen und final selbst senden.")}</p>
          </article>
        </div>

        <div className={styles.sandraUseCaseBenefits}>
          <div className={styles.sandraBenefitLead}>
            <span>🧠</span>
            <div>
              <strong>
                {t("Mit Kontaktwissen, KI und Follow-ups zum richtigen nächsten Schritt.")}
              </strong>
              <p>
                {t("FanMind denkt mit. Für echte Verbindungen und nachvollziehbare nächste Schritte.")}
              </p>
            </div>
          </div>
          <article>
            <span>◎</span>
            <strong>{t("Mehr Relevanz")}</strong>
            <p>{t("Jede Antwort nutzt Sandras Kontext und Kontaktwissen.")}</p>
          </article>
          <article>
            <span>↗</span>
            <strong>{t("Besseres Timing")}</strong>
            <p>{t("Passende Vorschläge entstehen aus Sandras Verlauf und aktuellem Bedarf.")}</p>
          </article>
          <article>
            <span>♡</span>
            <strong>{t("Mehr Loyalität")}</strong>
            <p>
              {t("Nächste Kontakte werden geplant, priorisiert und manuell freigegeben.")}
            </p>
          </article>
        </div>
      </section>


      <section
        id="integrationen"
        className={styles.integrationsSection}
        aria-labelledby="integrations-title"
      >
        <div className={styles.integrationsConstellationLeft} aria-hidden="true" />
        <div className={styles.integrationsConstellationRight} aria-hidden="true" />

        <div className={styles.integrationsHeader}>
          <div className={styles.integrationsBadge}>
            <span>⌬</span> {t("INTEGRATIONEN")}
          </div>
          <h2 id="integrations-title">
            {t("Ordne deine wichtigsten")} <span>{t("Kanäle ehrlich ein.")}</span>
          </h2>
          <p>{t("FanMind macht kontrollierte Multi-Channel-Arbeit transparent: angebundene Kanäle bleiben nutzbar, geplante Kanäle werden vorbereitet und erst nach technischer sowie rechtlicher Prüfung als aktiv gekennzeichnet. Unfertige Plattformen bleiben klar markiert.")}</p>
        </div>

        <div className={styles.integrationMarquee} aria-label={t("Vorbereitete und manuell nutzbare Kanäle")}>
          {localizedIntegrationMarqueeRows.map((row, rowIndex) => (
            <div className={styles.integrationMarqueeViewport} key={`integration-row-${rowIndex}`}>
              <div className={styles.integrationMarqueeTrack} data-row={rowIndex + 1}>
                {[...row, ...row].map((channel, channelIndex) => (
                  <article
                    className={`${styles.integrationChannelCard} ${isComingSoonStatus(channel.status) ? styles.cardWithComingSoon : ""}`}
                    data-tone={channel.tone}
                    key={`${channel.title}-${channelIndex}`}
                    aria-hidden={channelIndex >= row.length ? "true" : undefined}
                  >
                    <PlatformLogo className={styles.integrationChannelIcon} platform={channel.platform} size="md" />
                    <div>
                      <h3>{channel.title}</h3>
                      <p>{channel.text}</p>
                    </div>
                    {isReadyStatus(channel.status) ? (
                      <span className={styles.integrationStatusBadge}>
                        <span aria-hidden="true">✓</span>
                        {t("BEREIT")}
                      </span>
                    ) : null}
                    {isComingSoonStatus(channel.status) ? <ComingSoonMark size="small" className={styles.comingSoonImage} /> : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.integrationFlowPanel}>
          <div className={styles.integrationSourcePanel}>
            <strong>{t("DATENQUELLEN")}</strong>
            <div>
              {localizedIntegrationSources.map((source) => (
                <span
                  className={
                    source.platform === "webform"
                      ? styles.sourceReadyCard
                      : comingSoonIntegrationPlatforms.has(source.platform)
                        ? styles.cardWithComingSoon
                        : undefined
                  }
                  key={source.label}
                >
                  <PlatformLogo platform={source.platform} size="sm" />
                  {source.label}
                  {source.platform === "webform" ? (
                    <span className={styles.sourceReadyCheck} aria-label={t("Bereit")}>
                      ✓
                    </span>
                  ) : null}
                  {comingSoonIntegrationPlatforms.has(source.platform) ? <ComingSoonMark size="small" className={styles.comingSoonImage} /> : null}
                </span>
              ))}
            </div>
          </div>

          <svg
            className={styles.integrationFlowLinesLeft}
            aria-hidden="true"
            viewBox="0 0 120 124"
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <filter id="integration-flow-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.05" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="integration-flow-arrow-cyan"
                markerWidth="6.6"
                markerHeight="6.6"
                refX="5.4"
                refY="3.3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0.2 0.4 L 6.2 3.3 L 0.2 6.2 Q 1.4 3.3 0.2 0.4 z" />
              </marker>
            </defs>
            <g filter="url(#integration-flow-glow-cyan)">
              <path d="M 0 23 C 28 15 52 22 91 47" />
              <path d="M 0 50 C 31 45 57 50 92 59" />
              <path d="M 0 76 C 32 84 58 77 92 68" />
              <path d="M 1 100 C 32 101 60 89 91 77" />
            </g>
          </svg>

          <div className={styles.integrationBrainCard}>
            <div>🧠</div>
            <strong>FanMind</strong>
            <span>{t("Bündelt • Ordnet • Bereitet vor")}</span>
          </div>

          <svg
            className={styles.integrationFlowLinesRight}
            aria-hidden="true"
            viewBox="0 0 120 124"
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <filter id="integration-flow-glow-magenta" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.05" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="integration-flow-arrow-magenta"
                markerWidth="6.6"
                markerHeight="6.6"
                refX="5.4"
                refY="3.3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0.2 0.4 L 6.2 3.3 L 0.2 6.2 Q 1.4 3.3 0.2 0.4 z" />
              </marker>
            </defs>
            <g filter="url(#integration-flow-glow-magenta)">
              <path d="M 119 30 C 82 25 47 30 14 48" />
              <path d="M 119 54 C 84 50 48 50 13 58" />
              <path d="M 119 72 C 84 76 49 76 13 68" />
              <path d="M 118 92 C 82 96 48 92 14 78" />
            </g>
          </svg>

          <div className={styles.integrationActionPanel}>
            <strong>{t("AKTIONEN & ERGEBNISSE")}</strong>
            <div>
              {localizedIntegrationActions.map((action) => (
                <article
                  className={isComingSoonStatus(action.status) ? styles.cardWithComingSoon : undefined}
                  key={action.title}
                >
                  <span>{action.icon}</span>
                  <h3>{action.title}</h3>
                  {statusVariantFromLabel(action.status) && !isComingSoonStatus(action.status) ? (
                    <FeatureStatusLabel variant={statusVariantFromLabel(action.status)!}>{action.status}</FeatureStatusLabel>
                  ) : null}
                  <p>{action.text}</p>
                  <i aria-hidden="true">{action.status ? "·" : "✓"}</i>
                  {isComingSoonStatus(action.status) ? <ComingSoonMark size="small" className={styles.comingSoonImage} /> : null}
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.integrationBenefits}>
          {localizedIntegrationBenefits.map((benefit) => (
            <article data-tone={benefit.tone} key={benefit.title}>
              <span>{benefit.icon}</span>
              <div>
                <strong>{benefit.title}</strong>
                <p>{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.integrationCtaBox}>
          <div>
            <a className={styles.demoButton} href={loginHref}>
              <span>▶</span> {t("Kostenlos testen")}
            </a>
            <a className={styles.outlineButton} href="#kontakt">
              {t("Beratung anfragen")}
            </a>
          </div>
          <p>
            <span>{t("✓ Keine Kreditkarte erforderlich")}</span>
            <span>{t("✓ Aktiv, Beta und Coming Soon klar getrennt")}</span>
            <span>{t("✓ Kein automatischer Versand")}</span>
          </p>
        </div>
      </section>


      <section
        id="roadmap"
        className={styles.roadmapSection}
        aria-labelledby="roadmap-title"
      >
        <div className={styles.roadmapConstellationLeft} aria-hidden="true" />
        <div className={styles.roadmapConstellationRight} aria-hidden="true" />

        <div className={styles.roadmapHeader}>
          <div className={styles.roadmapBadge}>
            <span>♢</span> {t("ROADMAP & NÄCHSTE SCHRITTE")}
          </div>
          <h2 id="roadmap-title">
            FanMind <span>Roadmap</span>
          </h2>
          <p>{t("Was heute verfügbar ist – und was als Nächstes kommt.")}</p>
        </div>

        <RoadmapShowcase phases={localizedRoadmapPhases} ariaLabel={t("Roadmap-Phasen")} />

        <div className={styles.roadmapNotes}>
          {localizedRoadmapNotes.map((note) => (
            <article data-tone={note.tone} key={note.title}>
              <span>{note.icon}</span>
              <div>
                <strong>{note.title}</strong>
                <p>{note.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>


      <section
        id="responsive"
        className={styles.responsiveSection}
        aria-labelledby="responsive-title"
      >
        <div className={styles.responsiveOrbitOne} aria-hidden="true" />
        <div className={styles.responsiveOrbitTwo} aria-hidden="true" />

        <div className={styles.responsiveCopy}>
          <div className={styles.responsiveBadge}>
            <span>▯</span> {t("RESPONSIVE EXPERIENCE")}
          </div>
          <h2 id="responsive-title">
            {t("Desktop, Tablet und Mobile –")} <span>{t("überall klar.")}</span>
          </h2>
          <p>{t("FanMind ist für alle Bildschirmgrößen gestaltet: volle Übersicht am Desktop, schnelle Aktionen unterwegs und konsistente Fan-Daten für dein Team.")}</p>

          <div className={styles.responsiveBenefitList}>
            {localizedResponsiveBenefits.map((benefit) => (
              <article data-tone={benefit.tone} key={benefit.title}>
                <span>{benefit.icon}</span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </div>
              </article>
            ))}
          </div>

        </div>

        <div className={styles.responsiveShowcase} aria-label="FanMind Geräteansichten">
          <Image
            className={styles.responsiveDeviceVisual}
            src="/landing/08-responsive-devices.png"
            alt="FanMind Dashboard auf Desktop, Tablet und Smartphone"
            width={1536}
            height={1024}
            sizes="(max-width: 1180px) 100vw, 60vw"
            priority={false}
          />
        </div>

        <div className={styles.responsiveCtaPanel}>
          <div className={styles.responsiveCtaLead}>
            <span>🧠</span>
            <div>
              <strong>{t("FanMind auf jedem Screen.")}</strong>
              <p>{t("Volle Power, egal welches Gerät du nutzt.")}</p>
            </div>
          </div>
          <div className={styles.responsiveCtaActions}>
            <a className={styles.demoButton} href={loginHref}>
              <span>▶</span> {t("Kostenlos testen")}
            </a>
            <a className={styles.outlineButton} href="#kontakt">
              {t("Beratung anfragen")}
            </a>
          </div>
          <p>
            <span>{t("✓ Roadmap klar gekennzeichnet")}</span>
            <span>{t("✓ Keine Kreditkarte erforderlich")}</span>
            <span>{t("✓ Kein automatischer Versand")}</span>
            <span>{t("✓ Manuelle Freigabe")}</span>
          </p>
        </div>
      </section>


      <section
        id="preise"
        className={styles.pricingSection}
        aria-labelledby="pricing-title"
      >
        <span id="pricing" className={styles.anchorTarget} aria-hidden="true" />
        <div className={styles.pricingConstellation} aria-hidden="true" />

        <div className={styles.pricingHeader}>
          <div className={styles.pricingBadge}>
            {t("Für Agenturen, Creator-Teams & Communities")}
          </div>
          <h2 id="pricing-title">
            {t("Wähle das passende")} <span>{t("FanMind-Paket")}</span> {t("für deinen Einstieg.")}
          </h2>
          <p>{t("FanMind ist ein KI-gestützter Antwort- und Kontaktwissen-Assistent für Teams. Dieses Produkt konzentriert sich auf Kontakte, KI-Antwortvorschläge, Kontaktwissen, Follow-ups und CSV-Import.")}</p>
        </div>

        <div className={styles.pricingMarquee} aria-label="FanMind Pakete">
          <div className={styles.pricingGrid}>
            {[...localizedPricingPlans, ...localizedPricingPlans].map((plan, index) => (
              <article
                className={`${styles.pricingPlanCard} ${isComingSoonStatus(plan.status) ? styles.cardWithComingSoon : ""}`}
                data-featured={plan.featured ? "true" : undefined}
                data-tone={plan.tone}
                key={`${plan.name}-${index}`}
                aria-hidden={index >= localizedPricingPlans.length ? "true" : undefined}
              >
                {plan.eyebrow && <div className={styles.pricingPlanPill}>{plan.eyebrow}</div>}
                <div className={styles.pricingPlanIcon}>{plan.icon}</div>
                <h3>{plan.name}</h3>
                {statusVariantFromLabel(plan.status) ? (
                  <FeatureStatusLabel variant={statusVariantFromLabel(plan.status)!}>{plan.status}</FeatureStatusLabel>
                ) : null}
                <p>{plan.audience}</p>
                <div className={styles.pricingAmount}>
                  {plan.pricePrefix && <span>{plan.pricePrefix}</span>}
                  <strong>{plan.price}</strong>
                  <small>{plan.cadence}</small>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a href={plan.href} tabIndex={index >= localizedPricingPlans.length ? -1 : undefined}>
                  {plan.cta} <span>→</span>
                </a>
                {isComingSoonStatus(plan.status) ? <ComingSoonMark size="medium" className={styles.comingSoonImage} /> : null}
              </article>
            ))}
          </div>
        </div>

        <p className={styles.pricingTermsLink}>
          {language === "en"
            ? "Net prices. Stripe Tax determines the applicable VAT or reverse-charge treatment. "
            : "Nettopreise. Stripe Tax ermittelt die anwendbare Umsatzsteuer oder Reverse-Charge-Behandlung. "}
          <a href="/zahlungsbedingungen">{t("Zahlungsbedingungen")}</a>
        </p>

        <div className={styles.pricingProofBar}>
          {localizedPricingProofs.map((proof) => (
            <article data-tone={proof.tone} key={proof.title}>
              <span>{proof.icon}</span>
              <div>
                <strong>{proof.title}</strong>
                <p>{proof.text}</p>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.pricingCtaPanel}>
          <div>
            <h3>
              {t("Baue")} <span>{t("stärkere Fan-Beziehungen")}</span> {t("– mit weniger Chaos und besseren Antworten.")}
            </h3>
            <p>
              {t("FanMind bündelt Kontakte, KI, Kontaktwissen und Follow-ups an einem Ort.")}
            </p>
          </div>
          <div className={styles.pricingCtaActions}>
            <a className={styles.demoButton} href={loginHref}>
              <span>▷</span> {t("Kostenlos testen")}
            </a>
            <a className={styles.outlineButton} href="#kontakt">
              <span>🚀</span> {t("Beratung anfragen")}
            </a>
            <p>
              <span>{t("✓ Keine Kreditkarte erforderlich")}</span>
              <span>{t("✓ Schneller Einstieg")}</span>
              <span>{t("✓ Upgrade später möglich")}</span>
            </p>
          </div>
        </div>
      </section>

      <section
        id="datenschutz-kontrolle"
        className={styles.privacyControlSection}
        aria-labelledby="privacy-control-title"
      >
        <div className={styles.privacyControlAura} aria-hidden="true" />

        <div className={styles.privacyControlHero}>
          <div className={styles.privacyControlCopy}>
            <div className={styles.privacyControlBadge}>
              <span>🛡</span> {t("DATENSCHUTZ & KONTROLLE")}
            </div>
            <h2 id="privacy-control-title">
              {t("KI-Unterstützung mit")} <span>{t("Kontrolle.")}</span>
            </h2>
            <p>{t("FanMind unterstützt dein Team mit KI – während du die Kontrolle über Versand, Berechtigungen und Compliance jederzeit bewusst behältst.")}</p>

            <div className={styles.privacyImageFrame}>
              <Image
                src="/assets/Landingpage-KI.png"
                alt={t("FanMind KI-Unterstützung mit Kontrolle und Datenschutz")}
                width={577}
                height={334}
                className={styles.privacyControlImage}
                sizes="(max-width: 820px) 100vw, 46vw"
              />
            </div>
          </div>

          <div className={styles.privacyControlGrid}>
            {localizedPrivacyControlCards.map((card) => (
              <article className={`${styles.privacyControlCard} ${styles.cardWithComingSoon}`} data-tone={card.tone} key={card.title}>
                <span className={styles.privacyControlNumber}>{card.number}</span>
                <div className={styles.privacyControlIcon}>{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <div className={styles.privacyControlStatus}>
                  <span>{card.status}</span>
                </div>
                <ComingSoonMark size="small" className={styles.comingSoonImage} />
              </article>
            ))}
          </div>
        </div>

        <div className={styles.privacyControlStatement}>
          <div className={styles.privacyStatementIcon}>🛡</div>
          <h3>
            {t("Smarte KI.")} <span>{t("Volle Kontrolle.")}</span> <strong>{t("Sichere Daten.")}</strong>
          </h3>
          <p>{t("FanMind kombiniert KI-Unterstützung mit klaren Regeln, Transparenz und Datenschutz – für nachhaltiges Fan-Management.")}</p>
        </div>

        <div className={styles.privacyControlBottom}>
          <div className={styles.privacyBenefitList}>
            {localizedPrivacyControlBenefits.map((benefit) => (
              <article data-tone={benefit.tone} key={benefit.title}>
                <span>{benefit.icon}</span>
                <div>
                  <strong>{benefit.title}</strong>
                  <p>{benefit.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.privacyControlActions}>
            <a className={styles.demoButton} href="#datenschutz-kontrolle">
              <span>🔒</span> {t("Datenschutz ansehen")}
            </a>
            <a className={styles.outlineButton} href={loginHref}>
              {t("Kostenlos testen · 1 Stunde Demo-Zugang")} <span>→</span>
            </a>
            <p>
              <span>🛡</span> {t("Vertrauen entsteht durch Sicherheit. FanMind liefert klare KI-Unterstützung mit bewusster Kontrolle.")}
            </p>
          </div>
        </div>
      </section>


      <section
        id="faq"
        className={styles.faqSection}
        aria-labelledby="faq-title"
      >
        <div className={styles.faqAura} aria-hidden="true" />

        <div className={styles.faqMainGrid}>
          <div className={styles.faqIntro}>
            <div className={styles.faqBadge}>
              <span>?</span> {t("FAQ")}
            </div>
            <h2 id="faq-title">
              {t("Häufige Fragen zu")} <span>FanMind</span>
            </h2>
            <p>{t("Antworten auf die häufigsten Fragen von Creator, Clubs, Agenturen und Brands – klar, ehrlich und auf den Punkt.")}</p>

            <div className={styles.faqHighlightGrid}>
              {localizedFaqHighlights.map((item) => (
                <article className={styles.faqHighlightCard} data-tone={item.tone} key={item.title}>
                  <div className={styles.faqHighlightIcon}>{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <strong>{item.accent}</strong>
                </article>
              ))}
            </div>

            <div className={styles.faqAudienceCard}>
              <span>👥</span>
              <div>
                <strong>{t("Für Creator, Clubs, Agenturen und Brands.")}</strong>
                <p>{t("Antworten für Teams mit wachsenden Communities.")}</p>
              </div>
            </div>
          </div>

          <FaqAccordion items={localizedFaqs} label={t("Häufige Fragen")} />
        </div>

        <div className={styles.faqContactPanel}>
          <div className={styles.faqContactLead}>
            <span>🎧</span>
            <div>
              <h3>{t("Noch Fragen?")}</h3>
              <p>
                {t("Unser Team ist für dich da – persönlich, schnell und zuverlässig.")}
              </p>
            </div>
          </div>
          {localizedFaqContacts.map((contact) => (
            <article className={styles.faqContactItem} data-tone={contact.tone} key={contact.title}>
              <span>{contact.icon}</span>
              <div>
                <strong>{contact.title}</strong>
                <p>{contact.text}</p>
                <a href={contact.href}>{contact.cta} <span>→</span></a>
              </div>
            </article>
          ))}
        </div>
      </section>


      <footer id="ressourcen" className={styles.siteFooter} aria-labelledby="landing-footer-title">
        <div className={styles.landingFooterPanel}>
          <div className={styles.landingFooterBrand}>
            <Logo language={language} />
            <span id="landing-footer-title" className={styles.srOnly}>FanMind Footer</span>
          </div>

          <div className={styles.landingFooterNav}>
            {localizedLandingFooterColumns.map((column) => (
              <nav aria-label={column.title} key={column.title}>
                <h3>{column.title}</h3>
                {column.links.map((link) => (
                  <a href={link.href} key={link.label}>
                    {link.label}
                  </a>
                ))}
              </nav>
            ))}
          </div>

          <div id="kontakt" className={styles.landingFooterNewsletter}>
            <span className={styles.landingFooterMailIcon} aria-hidden="true">✉</span>
            <div>
              <h3>{t("Beratung anfragen")}</h3>
              <p>{t("Wir prüfen deinen Use Case und zeigen dir, wie FanMind in deinem Workflow eingesetzt werden kann.")}</p>
            </div>
            <FooterInquiryForm language={language} />
          </div>
        </div>

        <div className={styles.landingFooterBottom}>
          <p>© 2026 FanMind · {t("Alle Rechte vorbehalten.")}</p>
          <p>{t("Copy-&-Open-Workflow · Keine automatische Sendefunktion")}</p>
          <a className={styles.backTop} href="#top" aria-label="Nach oben">
            ↑
          </a>
        </div>
      </footer>
      </main>
    </>
  );
}
