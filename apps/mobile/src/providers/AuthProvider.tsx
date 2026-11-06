import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  AppState,
  type AppStateStatus,
} from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  MOBILE_PASSWORD_RECOVERY_REDIRECT,
  MobileAuthRecoveryPolicyError,
  normalizeRecoveryEmail,
  parseMobileAuthRecoveryUrl,
  validateNewPassword,
} from "@/lib/authRecoveryPolicy.mjs";
import {
  activateOfflineReadCacheOwner,
  disableOfflineReadCacheWrites,
  resumeOfflineReadCacheOwner,
} from "@/lib/offlineReadCache";
import { bestEffortDisableMobilePushRegistration } from "@/lib/mobilePushRegistration";
import { clearSecureLocalStorage } from "@/lib/secureStorage";
import { supabase } from "@/lib/supabase";

type RecoveryStatus = "idle" | "processing" | "ready" | "error";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  recoveryStatus: RecoveryStatus;
  recoveryError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updateRecoveredPassword: (
    password: string,
    confirmation: string,
  ) => Promise<string | null>;
  clearRecoveryState: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const RECOVERY_EVENT_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryAttemptActive = useRef(false);
  const recoveryLinkHandled = useRef(false);
  const recoveryEventResolver = useRef<(() => void) | null>(null);

  const clearRecoveryState = useCallback(() => {
    recoveryEventResolver.current = null;
    recoveryAttemptActive.current = false;
    recoveryLinkHandled.current = false;
    setRecoveryStatus("idle");
    setRecoveryError(null);
  }, []);

  const waitForPasswordRecoveryEvent = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (confirmed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        recoveryEventResolver.current = null;
        resolve(confirmed);
      };
      const timer = setTimeout(
        () => settle(false),
        RECOVERY_EVENT_TIMEOUT_MS,
      );
      recoveryEventResolver.current = () => settle(true);
    });
  }, []);

  const handleRecoveryUrl = useCallback(
    async (url: string) => {
      if (recoveryAttemptActive.current || recoveryLinkHandled.current) {
        return;
      }

      let parsed;
      try {
        parsed = parseMobileAuthRecoveryUrl(url);
      } catch (error) {
        if (
          error instanceof MobileAuthRecoveryPolicyError &&
          (error.code === "invalid_scheme" || error.code === "invalid_route")
        ) {
          return;
        }
        setRecoveryStatus("error");
        setRecoveryError(
          "Der Wiederherstellungslink ist ungültig oder abgelaufen. Fordere bitte einen neuen Link an.",
        );
        return;
      }

      recoveryAttemptActive.current = true;
      setRecoveryStatus("processing");
      setRecoveryError(null);

      try {
        if (parsed.mode === "pkce") {
          const recoveryEvent = waitForPasswordRecoveryEvent();
          const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (error) throw error;
          const confirmed = await recoveryEvent;
          if (!confirmed) {
            throw new Error("password_recovery_event_missing");
          }
          resumeOfflineReadCacheOwner(data.session?.user.id ?? null);
        } else {
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (error) throw error;
          resumeOfflineReadCacheOwner(data.session?.user.id ?? null);
          setRecoveryStatus("ready");
        }

        // Only a non-sensitive boolean is retained for duplicate suppression.
        // Recovery URLs can contain credentials and must never be cached in state or refs.
        recoveryLinkHandled.current = true;
      } catch {
        recoveryEventResolver.current = null;
        recoveryLinkHandled.current = false;
        setRecoveryStatus("error");
        setRecoveryError(
          "Der Wiederherstellungslink konnte nicht bestätigt werden. Fordere bitte einen neuen Link an.",
        );
      } finally {
        recoveryAttemptActive.current = false;
      }
    },
    [waitForPasswordRecoveryEvent],
  );

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      activateOfflineReadCacheOwner(data.session?.user.id ?? null);
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        activateOfflineReadCacheOwner(nextSession?.user.id ?? null);
        setSession(nextSession);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") {
          recoveryEventResolver.current?.();
          setRecoveryStatus("ready");
          setRecoveryError(null);
        }
      },
    );

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    const appStateSubscription = AppState.addEventListener(
      "change",
      onAppStateChange,
    );

    return () => {
      mounted = false;
      recoveryEventResolver.current = null;
      subscription.subscription.unsubscribe();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const processUrl = (url: string | null) => {
      if (active && url) void handleRecoveryUrl(url);
    };

    void Linking.getInitialURL().then(processUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => processUrl(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleRecoveryUrl]);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 8) {
      return "Bitte gib eine gültige E-Mail-Adresse und dein Passwort ein.";
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (!error) {
      resumeOfflineReadCacheOwner(data.session?.user.id ?? null);
    }
    return error ? "Anmeldung fehlgeschlagen. Bitte prüfe deine Zugangsdaten." : null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeRecoveryEmail(email);
    } catch {
      return "Bitte gib eine gültige E-Mail-Adresse ein.";
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: MOBILE_PASSWORD_RECOVERY_REDIRECT },
    );
    return error
      ? "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut."
      : null;
  }, []);

  const updateRecoveredPassword = useCallback(
    async (password: string, confirmation: string) => {
      if (recoveryStatus !== "ready" || !session) {
        return "Öffne zuerst einen gültigen Wiederherstellungslink aus deiner E-Mail.";
      }
      const validation = validateNewPassword(password, confirmation);
      if (!validation.ok || !validation.password) {
        if (validation.errors.includes("password_mismatch")) {
          return "Die beiden Passwörter stimmen nicht überein.";
        }
        return "Das Passwort muss 12 bis 128 Zeichen sowie mindestens einen Buchstaben und eine Zahl enthalten.";
      }

      const { error } = await supabase.auth.updateUser({
        password: validation.password,
      });
      if (error) {
        return "Das Passwort konnte gerade nicht aktualisiert werden. Fordere bei Bedarf einen neuen Link an.";
      }
      clearRecoveryState();
      return null;
    },
    [clearRecoveryState, recoveryStatus, session],
  );

  const signOut = useCallback(async () => {
    let failed = false;
    const activeAccessToken = session?.access_token;
    if (activeAccessToken) {
      await bestEffortDisableMobilePushRegistration(activeAccessToken);
    }

    try {
      await disableOfflineReadCacheWrites();
    } catch {
      failed = true;
    }

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      failed = failed || Boolean(error);
    } catch {
      failed = true;
    }

    try {
      await clearSecureLocalStorage();
    } catch {
      failed = true;
    }

    activateOfflineReadCacheOwner(null);
    setSession(null);
    clearRecoveryState();
    if (failed) {
      throw new Error(
        "Die lokale Sitzung wurde beendet, aber die sichere Datenbereinigung konnte nicht vollständig bestätigt werden.",
      );
    }
  }, [clearRecoveryState, session?.access_token]);

  const value = useMemo(
    () => ({
      session,
      loading,
      recoveryStatus,
      recoveryError,
      signIn,
      signOut,
      requestPasswordReset,
      updateRecoveredPassword,
      clearRecoveryState,
    }),
    [
      clearRecoveryState,
      loading,
      recoveryError,
      recoveryStatus,
      requestPasswordReset,
      session,
      signIn,
      signOut,
      updateRecoveredPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth muss innerhalb des AuthProvider verwendet werden.");
  return value;
}
