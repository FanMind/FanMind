import styles from "./FanMindLogo.module.css";

type FanMindLogoProps = {
  compact?: boolean;
  className?: string;
  href?: string;
  ariaLabel?: string;
  markOnly?: boolean;
  subtitle?: string;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function FanMindLogo({
  compact = false,
  className,
  href,
  ariaLabel = "FanMind Start",
  markOnly = false,
  subtitle,
}: FanMindLogoProps) {
  const content = (
    <>
      <span className={styles.logoIdentity}>
        <span className={styles.logoWordmark}>
          <span className={styles.logoWordFan}>Fan</span>
          <span className={styles.logoWordMind}>Mind</span>
        </span>
      </span>
      {subtitle && !compact && <small className={styles.logoSubtitle}>{subtitle}</small>}
    </>
  );

  const logoClassName = classNames(
    styles.logo,
    (compact || markOnly) && styles.logoCompact,
    className,
  );

  if (href) {
    return (
      <a className={logoClassName} href={href} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  return (
    <div className={logoClassName} aria-label="FanMind" title="FanMind">
      {content}
    </div>
  );
}
