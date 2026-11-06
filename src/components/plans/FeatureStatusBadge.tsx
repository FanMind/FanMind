import type { FeatureStatus } from "@/config/plans";
import FeatureStatusLabel, { type FeatureStatusLabelVariant } from "@/components/FeatureStatusLabel";

const statusLabels: Record<Exclude<FeatureStatus, "hidden">, string> = {
  active: "Aktiv",
  demo: "Demo",
  limited: "Limitiert",
  upgrade: "Upgrade",
  coming_soon: "Coming Soon",
  preview: "Vorschau",
};

const statusVariants: Record<Exclude<FeatureStatus, "hidden">, FeatureStatusLabelVariant> = {
  active: "active",
  demo: "demo",
  limited: "limited",
  upgrade: "upgrade",
  coming_soon: "coming-soon",
  preview: "preview",
};

type FeatureStatusBadgeProps = {
  status: FeatureStatus;
};

export default function FeatureStatusBadge({ status }: FeatureStatusBadgeProps) {
  if (status === "hidden") {
    return null;
  }

  return <FeatureStatusLabel variant={statusVariants[status]}>{statusLabels[status]}</FeatureStatusLabel>;
}
