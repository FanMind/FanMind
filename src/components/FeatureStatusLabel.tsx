import styles from "./FeatureStatusLabel.module.css";

export type FeatureStatusLabelVariant =
  | "coming-soon"
  | "roadmap"
  | "preview"
  | "planned"
  | "active"
  | "demo"
  | "limited"
  | "upgrade";

const DEFAULT_LABELS: Record<FeatureStatusLabelVariant, string> = {
  "coming-soon": "Coming Soon",
  roadmap: "Roadmap",
  preview: "Vorschau",
  planned: "Geplant",
  active: "Aktiv",
  demo: "Demo",
  limited: "Limitiert",
  upgrade: "Upgrade",
};

type FeatureStatusLabelProps = {
  variant: FeatureStatusLabelVariant;
  children?: string;
  className?: string;
  placement?: "inline" | "card-corner";
};

export default function FeatureStatusLabel({
  variant,
  children,
  className,
  placement = "inline",
}: FeatureStatusLabelProps) {
  const classNames = [
    styles.label,
    placement === "card-corner" ? styles.cardCorner : styles.inline,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} data-status={variant}>
      {children ?? DEFAULT_LABELS[variant]}
    </span>
  );
}
