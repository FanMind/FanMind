"use client";

import { useEffect, useMemo, useState } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "./AiPromptSettings.module.css";

type PromptProfile = {
  id?: string;
  name: string;
  instruction: string;
  isActive: boolean;
  isDefault: boolean;
};

type PromptSettings = {
  companyPrompt: string;
  profiles: PromptProfile[];
  updatedAt?: string | null;
};

type SettingsResponse = {
  ok?: boolean;
  settings?: PromptSettings;
  canManage?: boolean;
  error?: string;
};

const EMPTY_SETTINGS: PromptSettings = {
  companyPrompt: "",
  profiles: [],
};

const TEMPLATES = [
  {
    name: "Verkauf & Beratung",
    instruction:
      "Verstehe zuerst den Bedarf. Erkläre den konkreten Nutzen verständlich und biete einen passenden nächsten Schritt ohne Druck an. Erfinde keine Preise, Rabatte, Lieferzeiten oder Zusagen.",
  },
  {
    name: "Kundenservice",
    instruction:
      "Antworte klar, freundlich und lösungsorientiert. Fasse das Anliegen kurz zusammen, nenne nur belegte Lösungsschritte und stelle gezielte Rückfragen, wenn Informationen fehlen.",
  },
  {
    name: "Reklamation & Deeskalation",
    instruction:
      "Bleibe ruhig und wertschätzend. Zeige Verständnis, ohne ungeprüft Schuld, Erstattung oder Entschädigung zuzusagen. Kläre Fakten und schlage einen realistischen nächsten Prüfschritt vor.",
  },
  {
    name: "Community & Fans",
    instruction:
      "Antworte warm, persönlich und nahbar. Greife einen belegten Kontextpunkt auf, vermeide Standardfloskeln und halte die Beziehung menschlich, ohne künstliche Vertrautheit zu erfinden.",
  },
] as const;

function text(locale: FanMindLanguage, de: string, en: string) {
  return locale === "en" ? en : de;
}

function draftId() {
  return `draft-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

export function AiPromptSettings({
  locale,
  singleWritingStyle = false,
}: {
  locale: FanMindLanguage;
  singleWritingStyle?: boolean;
}) {
  const [settings, setSettings] = useState<PromptSettings>(EMPTY_SETTINGS);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const activeCount = useMemo(
    () => settings.profiles.filter((profile) => profile.isActive).length,
    [settings.profiles],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/prompt-settings", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | SettingsResponse
          | null;
        if (!response.ok || !data?.settings) {
          throw new Error(
            data?.error ??
              text(
                locale,
                "KI-Prompts konnten nicht geladen werden.",
                "AI prompts could not be loaded.",
              ),
          );
        }
        if (!active) return;
        setSettings(data.settings);
        setCanManage(data.canManage === true);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : text(
                  locale,
                  "KI-Prompts konnten nicht geladen werden.",
                  "AI prompts could not be loaded.",
                ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  function updateProfile(
    index: number,
    patch: Partial<PromptProfile>,
  ) {
    setStatus("");
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile, profileIndex) =>
        profileIndex === index ? { ...profile, ...patch } : profile,
      ),
    }));
  }

  function makeDefault(index: number) {
    setStatus("");
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile, profileIndex) => ({
        ...profile,
        isActive: profileIndex === index ? true : profile.isActive,
        isDefault: profileIndex === index,
      })),
    }));
  }

  function addTemplate(template: { name: string; instruction: string }) {
    if (settings.profiles.length >= 8) return;
    setStatus("");
    setSettings((current) => ({
      ...current,
      profiles: [
        ...current.profiles,
        {
          id: draftId(),
          name: template.name,
          instruction: template.instruction,
          isActive: true,
          isDefault: current.profiles.every(
            (profile) => !profile.isDefault,
          ),
        },
      ],
    }));
  }

  function addEmptyProfile() {
    if (settings.profiles.length >= 8) return;
    addTemplate({
      name: "Eigenes Profil",
      instruction:
        "Beschreibe hier, wie FanMind in dieser Situation antworten soll.",
    });
  }

  function removeProfile(index: number) {
    setStatus("");
    setSettings((current) => {
      const profiles = current.profiles.filter(
        (_, profileIndex) => profileIndex !== index,
      );
      if (
        profiles.some((profile) => profile.isActive) &&
        !profiles.some((profile) => profile.isDefault)
      ) {
        const firstActive = profiles.findIndex((profile) => profile.isActive);
        profiles[firstActive] = {
          ...profiles[firstActive],
          isDefault: true,
        };
      }
      return { ...current, profiles };
    });
  }

  async function save() {
    setError("");
    setStatus("");
    setSaving(true);
    try {
      const response = await fetch("/api/ai/prompt-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyPrompt: settings.companyPrompt,
          profiles: settings.profiles.map((profile) => ({
            id: profile.id?.startsWith("draft-") ? undefined : profile.id,
            name: profile.name,
            instruction: profile.instruction,
            isActive: profile.isActive,
            isDefault: profile.isDefault,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | SettingsResponse
        | null;
      if (!response.ok || !data?.settings) {
        throw new Error(
          data?.error ??
            text(
              locale,
              "KI-Prompts konnten nicht gespeichert werden.",
              "AI prompts could not be saved.",
            ),
        );
      }
      setSettings(data.settings);
      setStatus(
        text(
          locale,
          singleWritingStyle ? "Geschäftsregeln wurden gespeichert." : "Unternehmens-Prompt und Antwortprofile wurden gespeichert.",
          singleWritingStyle ? "Business rules were saved." : "Company prompt and reply profiles were saved.",
        ),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : text(
              locale,
              "KI-Prompts konnten nicht gespeichert werden.",
              "AI prompts could not be saved.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="ai-prompt-settings-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {text(locale, "Antwortqualität", "Reply quality")}
          </p>
          <h2 id="ai-prompt-settings-title">
            {text(
              locale,
              singleWritingStyle ? "Geschäftsregeln" : "Unternehmens-Prompt & Antwortprofile",
              singleWritingStyle ? "Business rules" : "Company prompt & reply profiles",
            )}
          </h2>
          <p>
            {text(
              locale,
              singleWritingStyle ? "Deinen einzigen Schreibstil bearbeitest du im Creator-Profil. Hier ergänzt du damit vereinbare Geschäftsregeln für alle Kanäle." : "Der Unternehmens-Prompt gilt für alle Antwortvorschläge. Zusätzlich kannst du bis zu acht Profile für unterschiedliche Gesprächssituationen anlegen.",
              singleWritingStyle ? "Edit your single writing style in the Creator profile. Add compatible business rules for all channels here." : "The company prompt applies to every reply suggestion. You can also create up to eight profiles for different conversation situations.",
            )}
          </p>
        </div>
        {!singleWritingStyle ? <span>{activeCount} / 8 {text(locale, "aktiv", "active")}</span> : null}
      </div>

      {loading ? (
        <p className={styles.notice}>
          {text(locale, "KI-Prompts werden geladen …", "Loading AI prompts…")}
        </p>
      ) : (
        <>
          <label className={styles.field}>
            <span>{text(locale, "Unternehmens-Prompt", "Company prompt")}</span>
            <textarea
              disabled={!canManage}
              maxLength={3000}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  companyPrompt: event.target.value,
                }))
              }
              placeholder={text(
                locale,
                singleWritingStyle ? "Beschreibe Leistungen, verbindliche Regeln, Grenzen und zulässige nächste Schritte." : "Beschreibe Unternehmen, Zielgruppe, Leistungen, gewünschte Ansprache, wichtige Regeln, No-Gos und den typischen nächsten Schritt.",
                singleWritingStyle ? "Describe services, binding rules, boundaries and permitted next steps." : "Describe the company, audience, services, preferred voice, important rules, no-gos and the typical next step.",
              )}
              rows={7}
              value={settings.companyPrompt}
            />
            <small>{settings.companyPrompt.length} / 3000</small>
          </label>

          {!singleWritingStyle ? <>
          <div className={styles.templateArea}>
            <div>
              <strong>{text(locale, "Empfohlene Profile", "Recommended profiles")}</strong>
              <small>
                {text(
                  locale,
                  "Vorlage übernehmen und anschließend anpassen.",
                  "Add a template and customize it.",
                )}
              </small>
            </div>
            <div className={styles.templateButtons}>
              {TEMPLATES.map((template) => (
                <button
                  disabled={!canManage || settings.profiles.length >= 8}
                  key={template.name}
                  onClick={() => addTemplate(template)}
                  type="button"
                >
                  + {template.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.profileList}>
            {settings.profiles.map((profile, index) => (
              <article className={styles.profileCard} key={profile.id ?? index}>
                <div className={styles.profileHeader}>
                  <strong>
                    {text(locale, "Antwortprofil", "Reply profile")} {index + 1}
                  </strong>
                  <div className={styles.profileActions}>
                    <label>
                      <input
                        checked={profile.isActive}
                        disabled={!canManage}
                        onChange={(event) =>
                          updateProfile(index, {
                            isActive: event.target.checked,
                            isDefault: event.target.checked
                              ? profile.isDefault
                              : false,
                          })
                        }
                        type="checkbox"
                      />
                      {text(locale, "Aktiv", "Active")}
                    </label>
                    <button
                      disabled={!canManage || profile.isDefault}
                      onClick={() => makeDefault(index)}
                      type="button"
                    >
                      {profile.isDefault
                        ? text(locale, "Standard", "Default")
                        : text(locale, "Als Standard", "Make default")}
                    </button>
                    <button
                      disabled={!canManage}
                      onClick={() => removeProfile(index)}
                      type="button"
                    >
                      {text(locale, "Entfernen", "Remove")}
                    </button>
                  </div>
                </div>
                <label className={styles.field}>
                  <span>{text(locale, "Name", "Name")}</span>
                  <input
                    disabled={!canManage}
                    maxLength={80}
                    onChange={(event) =>
                      updateProfile(index, { name: event.target.value })
                    }
                    value={profile.name}
                  />
                </label>
                <label className={styles.field}>
                  <span>{text(locale, "Prompt / Anweisung", "Prompt / instruction")}</span>
                  <textarea
                    disabled={!canManage}
                    maxLength={1500}
                    onChange={(event) =>
                      updateProfile(index, {
                        instruction: event.target.value,
                      })
                    }
                    rows={4}
                    value={profile.instruction}
                  />
                  <small>{profile.instruction.length} / 1500</small>
                </label>
              </article>
            ))}
          </div>

          </> : null}
          <div className={styles.footer}>
            <div>
              <p>
                {text(
                  locale,
                  "Keine Passwörter, Zugangsdaten oder unnötigen personenbezogenen Daten eintragen. Sicherheits-, Wahrheits- und Manuell-Senden-Regeln haben immer Vorrang.",
                  "Do not enter passwords, credentials or unnecessary personal data. Safety, truthfulness and manual-send rules always take precedence.",
                )}
              </p>
              {!canManage ? (
                <small>
                  {text(
                    locale,
                    "Nur der Workspace-Owner oder ein FanMind-Admin kann diese Prompts ändern.",
                    "Only the workspace owner or a FanMind admin can edit these prompts.",
                  )}
                </small>
              ) : null}
            </div>
            <div className={styles.footerActions}>
              {!singleWritingStyle ? <button
                disabled={!canManage || settings.profiles.length >= 8}
                onClick={addEmptyProfile}
                type="button"
              >
                {text(locale, "Leeres Profil", "Blank profile")}
              </button> : null}
              <button
                className={styles.primaryButton}
                disabled={!canManage || saving}
                onClick={() => void save()}
                type="button"
              >
                {saving
                  ? text(locale, "Speichert …", "Saving…")
                  : text(locale, "KI-Prompts speichern", "Save AI prompts")}
              </button>
            </div>
          </div>
          {status ? <p className={styles.success} role="status">{status}</p> : null}
        </>
      )}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
