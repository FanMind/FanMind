"use client";

import { FormEvent, useState } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "@/app/landing-v2/landing-v2.module.css";

type SubmitState = "idle" | "submitting" | "success" | "error";

type FooterInquiryFormProps = {
  language?: FanMindLanguage;
};

export function FooterInquiryForm({ language = "de" }: FooterInquiryFormProps) {
  const [state, setState] = useState<SubmitState>("idle");
  const copy =
    language === "en"
      ? {
          emailLabel: "Email address",
          emailPlaceholder: "you@example.com",
          nameLabel: "Name optional",
          namePlaceholder: "Your name",
          messageLabel: "Short message / use case optional",
          messagePlaceholder: "How should FanMind support your team?",
          companyLabel: "Company",
          submitting: "Sending ...",
          submit: "Request consultation",
          note: "A personal inquiry instead of an automated newsletter.",
          success: "Thank you. We will contact you shortly.",
          error:
            "The inquiry could not be sent right now. Please email fanmind@fanmind.ch directly.",
        }
      : {
          emailLabel: "E-Mail-Adresse",
          emailPlaceholder: "deine@email.ch",
          nameLabel: "Name optional",
          namePlaceholder: "Dein Name",
          messageLabel: "Kurze Nachricht / Use Case optional",
          messagePlaceholder: "Wobei soll FanMind euch unterstützen?",
          companyLabel: "Firma",
          submitting: "Wird gesendet ...",
          submit: "Beratung anfragen",
          note: "Persönliche Anfrage statt automatischem Newsletter.",
          success: "Danke, wir melden uns bei dir.",
          error:
            "Anfrage konnte gerade nicht gesendet werden. Bitte schreibe direkt an fanmind@fanmind.ch.",
        };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      return;
    }

    setState("submitting");
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: String(formData.get("name") ?? "").trim(),
        message: String(formData.get("message") ?? "").trim(),
        company: String(formData.get("company") ?? "").trim(),
        source: "landing_footer",
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setState("error");
      return;
    }

    form.reset();
    setState("success");
  }

  return (
    <form className={styles.footerInquiryForm} onSubmit={onSubmit} noValidate>
      <label className={styles.footerInquiryField}>
        <span>{copy.emailLabel}</span>
        <input
          type="email"
          name="email"
          placeholder={copy.emailPlaceholder}
          autoComplete="email"
          required
        />
      </label>
      <label className={styles.footerInquiryField}>
        <span>{copy.nameLabel}</span>
        <input
          type="text"
          name="name"
          placeholder={copy.namePlaceholder}
          autoComplete="name"
        />
      </label>
      <label
        className={`${styles.footerInquiryField} ${styles.footerInquiryMessage}`}
      >
        <span>{copy.messageLabel}</span>
        <textarea
          name="message"
          placeholder={copy.messagePlaceholder}
          rows={3}
        />
      </label>
      <label className={styles.footerInquiryHoneypot} aria-hidden="true">
        {copy.companyLabel}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        className={styles.landingFooterCta}
        type="submit"
        disabled={state === "submitting"}
      >
        {state === "submitting" ? copy.submitting : copy.submit} <span>→</span>
      </button>
      <small>{copy.note}</small>
      {state === "success" ? (
        <p className={styles.footerInquirySuccess}>{copy.success}</p>
      ) : null}
      {state === "error" ? (
        <p className={styles.footerInquiryError}>{copy.error}</p>
      ) : null}
    </form>
  );
}
