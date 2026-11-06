export type ReferenceSourceStatus = "pending" | "available";

export type ReferenceSource = {
  id: "google";
  label: string;
  status: ReferenceSourceStatus;
  profileUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  visible: boolean;
};

export type ReferenceStatusCard = {
  title: string;
  status: string;
  text: string;
  sourceId?: ReferenceSource["id"];
  visible: boolean;
};

export type Reference = {
  label: string;
  name: string;
  logoSrc: string;
  logoAlt: string;
  visible: boolean;
};

export const references: Reference[] = [];

export const referenceSources: ReferenceSource[] = [
  {
    id: "google",
    label: "Google Bewertungen",
    status: "pending",
    profileUrl: null,
    rating: null,
    reviewCount: null,
    visible: true,
  },
];

export const referenceStatusCards: ReferenceStatusCard[] = [
  {
    title: "Google Unternehmensprofil",
    status: "In Prüfung",
    text: "Öffentliche Bewertungen werden angezeigt, sobald das Profil live ist.",
    sourceId: "google",
    visible: true,
  },
  {
    title: "Kundenstimmen",
    status: "Bald verfügbar",
    text: "Echte Rückmeldungen von ersten Testnutzern werden hier später eingebunden.",
    visible: true,
  },
];

export function hasPublicRating(source: ReferenceSource): source is ReferenceSource & { rating: number; reviewCount: number } {
  return source.rating !== null && source.reviewCount !== null;
}

export function hasReviewProfileUrl(source: ReferenceSource): source is ReferenceSource & { profileUrl: string } {
  return source.profileUrl !== null;
}
