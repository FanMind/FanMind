import Image from "next/image";
import styles from "./ComingSoonMark.module.css";

export type ComingSoonMarkSize = "small" | "medium" | "overlay";

type ComingSoonMarkProps = {
  size?: ComingSoonMarkSize;
  className?: string;
  alt?: string;
};

export function ComingSoonMark({
  size = "medium",
  className,
  alt = "Coming Soon",
}: ComingSoonMarkProps) {
  return (
    <Image
      src="/assets/coming-soon-badge.png"
      alt={alt}
      width={1536}
      height={1024}
      className={[styles.comingSoonMark, styles[size], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
