import { AI_TIER_CONFIG } from "@/config/aiTiers.mjs";

function aiName(name: string) {
  return name.replace(/^KI\s+/, "AI ");
}

function germanMonthlyPrice(cents: number) {
  return `${cents / 100} €/Monat`;
}

function englishMonthlyPrice(cents: number) {
  return `€${cents / 100}/month`;
}

const plus = AI_TIER_CONFIG.plus;
const ultra = AI_TIER_CONFIG.ultra;
const standard = AI_TIER_CONFIG.standard;

const combinedAiPriceGerman = `${plus.name} +${germanMonthlyPrice(plus.monthlyAddOnCents)} · ${ultra.name} +${germanMonthlyPrice(ultra.monthlyAddOnCents)}`;
const combinedAiPriceEnglish = `${aiName(plus.name)} +${englishMonthlyPrice(plus.monthlyAddOnCents)} · ${aiName(ultra.name)} +${englishMonthlyPrice(ultra.monthlyAddOnCents)}`;

export const landingEnglishCopySupplement: Record<string, string> = {
  NEU: "NEW",
  "Kontrolle & Sicherheit": "Control & security",
  "ohne Versandautomatik.": "without automated sending.",
  "Quelle: Website-Formular, E-Mail-Postfach, WhatsApp Chat":
    "Source: website form, email inbox, WhatsApp chat",
  "Details anzeigen": "View details",
  "Kaufhistorie: 2 Upsells gekauft": "Purchase history: 2 upsells purchased",
  "Hi Sandra! Der Vorverkauf startet am 18. Mai um 10:00 Uhr.":
    "Hi Sandra! Presale starts on May 18 at 10:00.",
  "Alle Follow-ups anzeigen": "View all follow-ups",
  "Zielgruppe: 1.260": "Target audience: 1,260",
  "Besseres Timing": "Better timing",
  "Aus Anfrage wird": "An inquiry becomes",
  "hohes Kaufinteresse": "high purchase interest",
  "hohe Relevanz": "high relevance",
  "Demo-Signal": "demo signal",
  "Social-Kontext als Roadmap-Erweiterung.":
    "Social context as a roadmap extension.",
  "Mitgliedschaften als geplanter CRM-Kontext.":
    "Memberships as planned CRM context.",
  "Supporter-Profile als vorbereiteter Eingang.":
    "Supporter profiles as a prepared input.",
  "Video-Community als internationaler Roadmap-Kanal.":
    "Video community as an international roadmap channel.",
  "Kurzvideo-Community als Roadmap-Kanal.":
    "Short-video community as a roadmap channel.",
  "Chat-Anfragen als vorbereiteter Eingangskanal.":
    "Chat inquiries as a prepared input channel.",
  "Server-Kontext bleibt klar vorbereitet.":
    "Server context remains clearly prepared.",
  "Profil-Anfragen als geplanter Business-Kanal.":
    "Profile inquiries as a planned business channel.",
  "Reviews / Bewertungen": "Reviews / ratings",
  "Feedback-Quellen als ehrlicher Roadmap-Block.":
    "Feedback sources as a transparent roadmap block.",
  "Store-Feedback als geplanter Eingang.":
    "Store feedback as a planned input.",
  "Shop-Interaktionen als geplanter Kanal.":
    "Shop interactions as a planned channel.",
  "Internationaler Messaging-Kanal auf der Roadmap.":
    "International messaging channel on the roadmap.",
  "Community-Commerce-Kontext als Roadmap-Thema.":
    "Community commerce context as a roadmap topic.",
  "Messaging-Kontext als Roadmap-Erweiterung.":
    "Messaging context as a roadmap extension.",
  "Beta / vorbereitet": "Beta / prepared",
  "Manueller Workflow": "Manual workflow",
  "Dashboard & Fans": "Dashboard & fans",
  "Erledigt / Basis steht": "Done / foundation established",
  "Fan-Mapping": "Fan mapping",
  "Meta-Vorbereitung": "Meta preparation",
  "Beta / in Vorbereitung": "Beta / in preparation",
  Pflicht: "Required",
  "Verkaufsstart vorbereitet": "Sales launch prepared",
  "Produktions- & Billing-Basis": "Production & billing foundation",
  "Technisch abgeschlossen": "Technically complete",
  "Finaler Smoke-Test": "Final smoke test",
  "Stripe-Live-Schritte": "Stripe live steps",
  Erledigt: "Done",
  "Abrechnung & Admin-Basis": "Billing & admin foundation",
  "Erledigt / Feinschliff": "Done / fine-tuning",
  "Profil/Paket/Rechnungen": "Profile/package/invoices",
  "Sales-Unterlagen": "Sales materials",
  Produktionsfreigabe: "Production approval",
  "Finaler Go-Live-Smoke-Test": "Final go-live smoke test",
  "Produktion & Testumgebung": "Production & test environment",
  Gestartet: "Started",
  "Technisch abgesichert": "Technically safeguarded",
  "Operations-Grundlage": "Operations foundation",
  "Produktiv aktiv": "Active in production",
  "Produktions- und Testdaten trennen": "Separate production and test data",
  "Policy aktiv · Staging offen": "Policy active · staging pending",
  "Technik fertig · externe Ressourcen offen":
    "Technical package complete · external resources pending",
  "Release-Checks": "Release checks",
  "Automatisch aktiv": "Automatically active",
  "Umgebungs-Governance": "Environment governance",
  "Fail-closed aktiv · Staging offen": "Fail-closed active · staging pending",
  "Fail-closed aktiv": "Fail-closed active",
  "Mobile-App für Android & iOS": "Mobile app for Android & iOS",
  "App-Kern vorhanden · interne Builds offen": "App core available · internal builds pending",
  "Eigenständiger Expo-/React-Native-App-Kern": "Independent Expo/React Native app core",
  Vorhanden: "Available",
  "Login, Dashboard, Kontakte, Kontaktwissen, KI und Follow-ups": "Login, dashboard, contacts, contact knowledge, AI and follow-ups",
  "Phase A erledigt": "Phase A complete",
  "Web-/Mobile-Follow-up-Status synchronisiert": "Web/mobile follow-up status synchronized",
  "completed + Legacy done": "completed + legacy done",
  "Signierter interner Android-Build": "Signed internal Android build",
  "EAS-/Signing-Einrichtung offen": "EAS/signing setup pending",
  "iOS-TestFlight": "iOS TestFlight",
  "Apple-Konto und Signing offen": "Apple account and signing pending",
  "Passwort-Reset und Kontaktbearbeitung": "Password reset and contact editing",
  "Im App-Kern vorhanden": "Available in the app core",
  "Antwort kopieren und nativ teilen": "Copy and natively share replies",
  "Nur gewählter Text · Versand manuell": "Selected text only · manual sending",
  "Verschlüsselte Offline-Kontaktübersicht": "Encrypted offline contact overview",
  "24 h · maximal 50 · nur lesen": "24 h · up to 50 · read-only",
  "Push für Follow-up-Erinnerungen": "Push for follow-up reminders",
  "Nächste Mobile-Phase": "Next mobile phase",
  "Konfiguration und Routing fertig · Zustellung offen":
    "Configuration and routing ready · Delivery pending",
  "Weitere Social-Kanäle": "Additional social channels",
  "Finaler Technikblock vor Verkaufsübergabe":
    "Final technical block before sales handoff",
  Verkaufsübergabe: "Sales handoff",
  "Nach technischer Abnahme Phase 3 + Phase 7":
    "After technical acceptance of Phase 3 + Phase 7",
  "Website-KI, iOS & weitere Kanäle": "Website AI, iOS & additional channels",
  "Website-KI begonnen · übrige Anbindungen später":
    "Website AI started · remaining integrations later",
  "Einbettbarer Website-KI-Assistent": "Embeddable website AI assistant",
  "Sicherheits-, Widget- und Nachrichtenbasis vorbereitet":
    "Security, widget and messaging foundation prepared",
  "Gesprächsverlauf in FanMind": "Conversation history in FanMind",
  "Eingehende Nachrichten und Inbox-Zuordnung vorbereitet":
    "Incoming messages and inbox routing prepared",
  "KI-Antworten und Übergabe an den Nutzer": "AI replies and handoff to the user",
  "KI-Dialog und Eskalation noch umzusetzen":
    "AI dialogue and escalation still to be implemented",
  "E-Mail-Rückkanal für Besucher": "Email return channel for visitors",
  "E-Mail-Erfassung, Einwilligung und Antwortzustellung noch umzusetzen":
    "Email capture, consent and reply delivery still to be implemented",
  "Vollständige Phase-8-Umsetzung nach Abschluss von Phase 7":
    "Complete Phase 8 implementation after Phase 7",
  "Website-KI-Grundlage bereits begonnen": "Website AI foundation already started",
  "Segmente & Listen": "Segments & lists",
  "Segment-Ansichten": "Segment views",
  Vorbereitet: "Prepared",
  Listenlogik: "List logic",
  "Filter & Tags": "Filters & tags",
  "Analytics & Reichweitenerkennung": "Analytics & reach detection",
  "Performance-Signale": "Performance signals",
  "Fan-/Kanal-Reichweite erkennen": "Detect fan/channel reach",
  Ehrlich: "Transparent",
  "Team & Rollen/Rechte": "Team & roles/permissions",
  "Rollen/Rechte": "Roles/permissions",
  "Auditierbare Freigaben": "Auditable approvals",
  "Mehrere Workspaces": "Multiple workspaces",
  "Agency-Ansichten": "Agency views",
  "Workspace-Grenzen": "Workspace boundaries",
  "Kostenpflichtige KI-Erweiterungen": "Paid AI extensions",
  [plus.name]: aiName(plus.name),
  "bezahlte Erweiterung": "paid add-on",
  [ultra.name]: aiName(ultra.name),
  "Premium-Erweiterung": "Premium add-on",
  "Prompt-Bibliothek": "Prompt library",
  "Fan-spezifische Prompts": "Fan-specific prompts",
  "Datenschutz & Kontrolle": "Privacy & control",
  "DSGVO-orientierte Einwilligungen": "GDPR-oriented consents",
  "Audit-Log": "Audit log",
  "Do-not-push-Regeln": "Do-not-push rules",
  Kontrollprinzip: "Control principle",
  "EU-Datenfokus": "EU data focus",
  Produktprinzip: "Product principle",
  "✓ Roadmap klar gekennzeichnet": "✓ Roadmap clearly marked",
  "Ein produktiver Workspace": "One productive workspace",
  [`${standard.name} enthalten`]: `${aiName(standard.name)} included`,
  "Setup inklusive": "Setup included",
  "Externe Integrationen nur Beta/Roadmap":
    "External integrations only beta/roadmap",
  "Coming Soon · noch nicht produktiv buchbar":
    "Coming soon · not yet bookable in production",
  "Mehrere Profile als Ausbaupfad geplant":
    "Multiple profiles planned as an expansion path",
  "Kundenfeedback bestimmt den Ausbau": "Customer feedback guides expansion",
  "Noch nicht kaufbar dargestellt": "Not shown as purchasable",
  "Auf Anfrage": "On request",
  "Multi-Workspace / Agency-Ansichten geplant":
    "Multi-workspace / agency views planned",
  "Analytics & Reichweite nicht als Live-Suite":
    "Analytics & reach not presented as a live suite",
  "KI bleibt Assistenz": "AI remains an assistant",
  "Sicherer Zahlungsprozess": "Secure payment process",
  "Transparente Nachvollziehbarkeit": "Transparent traceability",
  "Wichtige Schritte werden klar sichtbar eingeordnet.":
    "Important steps are clearly classified.",
  "Alles an einem Ort": "Everything in one place",
  "KI, die versteht": "AI that understands",
  "Intelligent & kontextbasiert": "Intelligent & context-aware",
  "Sicher & DSGVO-orientiert": "Secure & GDPR-oriented",
  "Vertrauen & Transparenz": "Trust & transparency",
  "Messbar mehr Wirkung": "Measurably greater impact",
  "Mehr Impact, weniger Aufwand": "More impact, less effort",
  "Bestehende Nutzer gelangen direkt in ihren FanMind-Workspace.":
    "Existing users go directly to their FanMind workspace.",
  Rechtliches: "Legal",
  "Referral-Bedingungen": "Referral terms",
  "Alle Rechte vorbehalten.": "All rights reserved.",
  [combinedAiPriceGerman]: combinedAiPriceEnglish,
};