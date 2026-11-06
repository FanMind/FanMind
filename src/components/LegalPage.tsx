import Link from "next/link";
import type { ReactNode } from "react";
import { FanMindLogo } from "@/components/FanMindLogo";
import styles from "@/app/datenschutz/datenschutz.module.css";

export type LegalSection = {
  title: string;
  body: ReactNode[];
};

type LegalPageProps = {
  badge: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  children?: ReactNode;
};

function slug(value: string) {
  return value.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
}

export function LegalHeader() {
  return (
    <header className={styles.header}>
      <FanMindLogo className={styles.logo} href="/" ariaLabel="FanMind Startseite öffnen" />
      <nav className={styles.nav} aria-label="Rechtsseiten Navigation">
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <a href="/agb">AGB</a>
        <a href="/zahlungsbedingungen">Zahlungsbedingungen</a>
      </nav>
    </header>
  );
}

export function LegalPage({ badge, title, intro, sections, children }: LegalPageProps) {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden="true" />
      <LegalHeader />
      <section className={styles.hero} aria-labelledby="legal-title">
        <p className={styles.badge}>{badge}</p>
        <h1 id="legal-title">{title}</h1>
        <p>{intro}</p>
        <Link className={styles.homeLink} href="/">Zurück zu FanMind</Link>
      </section>
      <section className={styles.content} aria-label={`${title} Inhalt`}>
        <aside className={styles.toc} aria-label="Inhaltsverzeichnis">
          <strong>Kapitel</strong>
          {sections.map((section) => <a key={section.title} href={`#${slug(section.title)}`}>{section.title}</a>)}
        </aside>
        <div className={styles.sections}>
          {children}
          {sections.map((section) => (
            <article className={styles.card} id={slug(section.title)} key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph, index) => <p key={`${section.title}-${index}`}>{paragraph}</p>)}
            </article>
          ))}
        </div>
      </section>
      <a className={styles.backTop} href="#top" aria-label="Nach oben">↑</a>
    </main>
  );
}
