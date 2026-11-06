"use client";

import { useState } from "react";
import styles from "./landing-v2.module.css";

type FaqAccordionItem = {
  number: string;
  question: string;
  answer: string;
  open?: boolean;
};

type FaqAccordionProps = {
  items: FaqAccordionItem[];
  label: string;
};

const compactQuestions: Record<string, string> = {
  "Für wen ist FanMind gedacht?": "Für wen ist FanMind?",
  "Who is FanMind for?": "Who is FanMind for?",
  "Kann FanMind E-Mail, WhatsApp und Chat verbinden?":
    "Welche Kanäle unterstützt FanMind?",
  "Can FanMind connect email, WhatsApp and chat?":
    "Which channels does FanMind support?",
  "Sendet die KI automatisch Nachrichten?": "Sendet FanMind automatisch?",
  "Does the AI send messages automatically?": "Does FanMind send automatically?",
  "Wie schützt FanMind meine Daten?": "Wie schützt FanMind meine Daten?",
  "How does FanMind protect my data?": "How does FanMind protect my data?",
  "Kann ich mehrere Profile oder Kunden verwalten?":
    "Kann ich mehrere Profile verwalten?",
  "Can I manage multiple profiles or clients?":
    "Can I manage multiple profiles?",
  "Kann ich bestehende Kontakte importieren?": "Kann ich Kontakte importieren?",
  "Can I import existing contacts?": "Can I import contacts?",
  "Gibt es Zugang oder eine Demo?": "Gibt es eine Demo?",
  "Is there access or a demo?": "Is there a demo?",
};

function getCompactQuestion(question: string) {
  return compactQuestions[question] ?? question;
}

export default function FaqAccordion({ items, label }: FaqAccordionProps) {
  const initialOpenIndex = Math.max(
    0,
    items.findIndex((item) => item.open),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(initialOpenIndex);

  return (
    <div className={styles.faqList} aria-label={label}>
      {items.map((faq, index) => {
        const isOpen = activeIndex === index;
        const contentId = `landing-faq-answer-${faq.number}`;
        const question = getCompactQuestion(faq.question);

        return (
          <article
            className={styles.faqItem}
            data-open={isOpen ? "true" : undefined}
            key={faq.number}
          >
            <h3>
              <button
                aria-controls={contentId}
                aria-expanded={isOpen}
                aria-label={question}
                onClick={() => setActiveIndex(isOpen ? null : index)}
                type="button"
              >
                <span>{faq.number}</span>
                <strong>{question}</strong>
                <i aria-hidden="true" />
              </button>
            </h3>
            <p hidden={!isOpen} id={contentId}>
              {faq.answer}
            </p>
          </article>
        );
      })}
    </div>
  );
}
