import Link from "next/link";
import styles from "./LegalTopHeader.module.css";

type LegalTopHeaderKey =
  | "impressum"
  | "datenschutz"
  | "avv"
  | "agb"
  | "zahlungsbedingungen"
  | "referral";

type LegalTopHeaderProps = {
  active: LegalTopHeaderKey;
};

const legalNavigation: Array<{
  href: string;
  label: string;
  key: LegalTopHeaderKey;
}> = [
  { href: "/impressum", label: "Impressum", key: "impressum" },
  { href: "/datenschutz", label: "Datenschutz", key: "datenschutz" },
  { href: "/avv", label: "AVV", key: "avv" },
  { href: "/agb", label: "AGB", key: "agb" },
  {
    href: "/zahlungsbedingungen",
    label: "Zahlungsbedingungen",
    key: "zahlungsbedingungen",
  },
  {
    href: "/referral-bedingungen",
    label: "Referral",
    key: "referral",
  },
];

export default function LegalTopHeader({ active }: LegalTopHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          className={styles.logoLink}
          href="/"
          aria-label="Zur FanMind Startseite"
        >
          <span>Fan</span>Mind
        </Link>
        <nav className={styles.nav} aria-label="Rechtsseiten Navigation">
          {legalNavigation.map((item) => {
            const isActive = item.key === active;

            return (
              <Link
                className={isActive ? styles.activeLink : undefined}
                href={item.href}
                key={item.key}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
