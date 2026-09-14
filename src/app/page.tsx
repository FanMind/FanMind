import type { Metadata } from "next";
import LandingV2 from "./landing-v2/page";
import { getFanMindLanguage } from "@/lib/fanmindCopy";

type LandingPageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({
  searchParams,
}: LandingPageProps): Promise<Metadata> {
  const params = await searchParams;
  const language = getFanMindLanguage(params?.lang);

  if (language === "en") {
    return {
      title: "FanMind | AI CRM for creators, clubs and events",
      description:
        "FanMind brings contacts, conversations, contact knowledge and follow-ups together for smarter fan relationships. External integrations remain clearly marked as coming soon until technical and legal approval.",
    };
  }

  return {
    title: "FanMind | KI-CRM für Creator, Clubs und Events",
    description:
      "FanMind bündelt Kontakte, Gespräche, Kontaktwissen und Follow-ups für smarte Fan-Beziehungen; externe Integrationen bleiben bis zur technischen und rechtlichen Freigabe klar als Coming Soon markiert.",
  };
}

export default LandingV2;
