"use client";

import { type FormEvent, use, useEffect, useMemo, useRef, useState } from "react";
import { FanMindLogo } from "@/components/FanMindLogo";
import { getFanMindLanguage, landingPath, localizedPath } from "@/lib/fanmindCopy";
import { createSupabaseBrowserClient, syncSupabaseSessionForServer } from "@/lib/supabase/client";
import { buildWebRegistrationRedirect, readWebRegistrationSession, registrationErrorMessage } from "@/lib/webRegistrationPolicy.mjs";
import styles from "../register.module.css";

export default function ConfirmRegistrationPage({ searchParams }: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const language = getFanMindLanguage(use(searchParams).lang);
  const english = language === "en";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const callback = useRef<ReturnType<typeof readWebRegistrationSession> | undefined>(undefined);
  const [checking, setChecking] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const setupHref = english ? "/workspace/setup?lang=en" : "/workspace/setup";
  const confirmHref = english ? "/register/confirm?lang=en" : "/register/confirm";
  const loginHref = `${localizedPath("/login", language)}${english ? "&" : "?"}returnTo=${encodeURIComponent(setupHref)}`;

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setTimeout(() => setResendCooldown(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resending || resendCooldown) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setResending(true);
    setResendCooldown(true);
    try {
      const result = await supabase.auth.resendSignup({ email,
        emailRedirectTo: buildWebRegistrationRedirect(window.location.origin, language) });
      setResendNotice(result.error ? registrationErrorMessage(result.error, language)
        : english ? "Please check your inbox. If your email is already confirmed, sign in."
          : "Bitte prüfe dein Postfach. Wenn deine E-Mail bereits bestätigt ist, melde dich an.");
    } catch (error) { setResendNotice(registrationErrorMessage(error, language)); }
    finally { setResending(false); }
  }

  useEffect(() => {
    let active = true;
    let generation = 0;
    async function verify() {
      const current = ++generation;
      if (callback.current === undefined) callback.current = readWebRegistrationSession(window.location);
      const session = callback.current;
      // Credentials, provider errors and unexpected query values disappear
      // before the first asynchronous request. Nothing is persisted locally.
      window.history.replaceState(null, "", confirmHref);
      try {
        const result = session ? await supabase.auth.getUser(session.access_token) : null;
        if (!active || current !== generation) return;
        const user = result?.data.user;
        setVerifiedEmail(!result?.error && user?.id && user.email && user.email_confirmed_at ? user.email : null);
      } catch {
        if (active && current === generation) setVerifiedEmail(null);
      } finally {
        if (active && current === generation) setChecking(false);
      }
    }
    function changed() {
      callback.current = undefined;
      setVerifiedEmail(null);
      setChecking(true);
      setContinuing(false);
      setError(false);
      void verify();
    }
    window.addEventListener("hashchange", changed);
    void verify();
    return () => { active = false; window.removeEventListener("hashchange", changed); };
  }, [confirmHref, supabase]);

  async function continueWithAccount() {
    const session = callback.current;
    if (!session || !verifiedEmail || checking || continuing) return;
    setContinuing(true);
    try {
      // The verified address is shown before the user chooses this account.
      await syncSupabaseSessionForServer(session);
      if (callback.current !== session) return;
      callback.current = null;
      window.location.replace(setupHref);
    } catch {
      if (callback.current === session) { setError(true); setContinuing(false); }
    }
  }

  return <main className={styles.page}>
    <div className={styles.gridPattern} aria-hidden="true" />
    <section className={styles.shell}>
      <header className={styles.header}><FanMindLogo compact className={styles.logo} href={landingPath(language)} /></header>
      <div className={styles.authGrid}>
        <section className={styles.formCard}>
          <div className={styles.formHeader}>
            <p className={styles.eyebrow}>{english ? "2 · Confirm email" : "2 · E-Mail bestätigen"}</p>
            <h1>{checking ? (english ? "Checking your link…" : "Dein Link wird geprüft…")
              : verifiedEmail ? (english ? "Your email is confirmed" : "Deine E-Mail ist bestätigt")
                : (english ? "Continue with your account" : "Mit deinem Konto fortfahren")}</h1>
          </div>
          {checking ? <p role="status">{english ? "Please wait a moment." : "Einen Moment bitte."}</p>
            : verifiedEmail ? <>
              <p>{verifiedEmail}</p>
              <p>{english ? "Your account is ready. Continue to your package setup." : "Dein Konto ist bereit. Weiter zur Einrichtung deines Pakets."}</p>
              <button type="button" className={styles.primaryButton} disabled={continuing} onClick={continueWithAccount}>
                {english ? "Continue with this account" : "Mit diesem Konto fortfahren"}
              </button>
            </> : <p className={styles.notice} role="status">
              {english ? "This link is invalid, expired or has already been used. If you have already confirmed your email, sign in. Otherwise request a new confirmation below." : "Dieser Link ist ungültig, abgelaufen oder wurde bereits verwendet. Wenn du deine E-Mail bereits bestätigt hast, melde dich an. Andernfalls fordere hier eine neue Bestätigung an."}
            </p>}
          {!checking && !verifiedEmail && <form onSubmit={resend}>
            <label className={styles.field}>
              <span>{english ? "Email address" : "E-Mail-Adresse"}</span>
              <div className={styles.inputWrap}><input type="email" name="email" autoComplete="email" maxLength={254} required /></div>
            </label>
            <button type="submit" className={styles.primaryButton} disabled={resending || resendCooldown}>
              {resendCooldown ? (english ? "Please wait 60 seconds" : "Bitte 60 Sekunden warten")
                : (english ? "Request a new confirmation" : "Neue Bestätigung anfordern")}
            </button>
            {resendNotice && <p className={styles.notice} role="status">{resendNotice}</p>}
          </form>}
          {error && <p className={styles.error} role="alert">{english ? "Please sign in to continue. Your account does not need to be created again." : "Bitte melde dich an, um fortzufahren. Dein Konto muss nicht erneut angelegt werden."}</p>}
          <div className={styles.footerLinks}>
            <a href={loginHref}>{english ? "Sign in" : "Anmelden"}</a>
            <a href={localizedPath("/register", language)}>{english ? "Registration" : "Registrierung"}</a>
            <a href={localizedPath("/forgot-password", language)}>{english ? "Reset password" : "Passwort zurücksetzen"}</a>
          </div>
          <p className={styles.notice}>{english ? "Confirming your email does not start a paid subscription." : "Mit der E-Mail-Bestätigung beginnt kein kostenpflichtiges Abo."}</p>
        </section>
      </div>
    </section>
  </main>;
}
