import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
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
  decideNotificationIntent,
  MESSAGE_NOTIFICATION_NAVIGATION_SECTION_PREFIX,
  MESSAGE_NOTIFICATION_SECTION,
  type NotificationIntent,
} from "@/lib/pushNotificationPolicy.mjs";
import {
  clearLastNotificationIntent,
  configureNotificationChannel,
  getLastNotificationIntent,
  registerNotificationResponseListener,
} from "@/lib/pushNotifications";
import { useAuth } from "@/providers/AuthProvider";

type NotificationIntentContextValue = {
  pendingIntent: NotificationIntent | null;
};

const NotificationIntentContext =
  createContext<NotificationIntentContextValue | null>(null);
const MAX_CONSUMED_RESPONSE_IDENTIFIERS = 32;

export function NotificationIntentProvider({
  children,
}: PropsWithChildren) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{
    section?: string | string[];
  }>();
  const currentSection = Array.isArray(globalParams.section)
    ? globalParams.section[0] ?? null
    : globalParams.section ?? null;
  const [pendingIntent, setPendingIntent] = useState<NotificationIntent | null>(
    null,
  );
  const pendingIdentifier = useRef<string | null>(null);
  const navigationIssuedIdentifier = useRef<string | null>(null);
  const messageNavigationNonce = useRef(0);
  const consumedIdentifiers = useRef<string[]>([]);

  const acceptIntent = useCallback((intent: NotificationIntent) => {
    if (
      pendingIdentifier.current === intent.responseIdentifier ||
      consumedIdentifiers.current.includes(intent.responseIdentifier)
    ) {
      return;
    }
    pendingIdentifier.current = intent.responseIdentifier;
    navigationIssuedIdentifier.current = null;
    setPendingIntent(intent);
  }, []);

  useEffect(() => {
    void configureNotificationChannel().catch(() => undefined);

    // Register first so a tap cannot fall into the gap before the initial
    // native response is read.
    const subscription = registerNotificationResponseListener(acceptIntent);
    try {
      const initialIntent = getLastNotificationIntent();
      if (initialIntent) acceptIntent(initialIntent);
    } catch {
      // Native notification state is optional until a signed build exists.
    }

    return () => subscription.remove();
  }, [acceptIntent]);

  useEffect(() => {
    const navigationIssued =
      pendingIntent != null &&
      navigationIssuedIdentifier.current === pendingIntent.responseIdentifier;
    const decision = decideNotificationIntent({
      authLoading: loading,
      hasSession: Boolean(session),
      segments,
      pathname,
      currentSection,
      navigationIssued,
      pendingIntent,
    });
    if (decision === "navigate" && pendingIntent) {
      navigationIssuedIdentifier.current = pendingIntent.responseIdentifier;
      if (
        pendingIntent.section === MESSAGE_NOTIFICATION_SECTION &&
        pathname === pendingIntent.consumePathname
      ) {
        messageNavigationNonce.current += 1;
        router.setParams({
          section: `${MESSAGE_NOTIFICATION_NAVIGATION_SECTION_PREFIX}${messageNavigationNonce.current}`,
        });
      } else {
        router.replace(pendingIntent.route);
      }
      return;
    }
    if (decision !== "consume" || !pendingIntent) return;

    const responseIdentifier = pendingIntent.responseIdentifier;
    consumedIdentifiers.current = [
      ...consumedIdentifiers.current.filter(
        (identifier) => identifier !== responseIdentifier,
      ),
      responseIdentifier,
    ].slice(-MAX_CONSUMED_RESPONSE_IDENTIFIERS);
    pendingIdentifier.current = null;
    if (navigationIssuedIdentifier.current === responseIdentifier) {
      navigationIssuedIdentifier.current = null;
    }
    setPendingIntent((current) =>
      current?.responseIdentifier === responseIdentifier ? null : current,
    );
    try {
      clearLastNotificationIntent();
    } catch {
      // Native cleanup is best effort. In-memory consumption must still stop
      // a stale native response from trapping navigation on its destination.
    }
  }, [
    currentSection,
    loading,
    pathname,
    pendingIntent,
    router,
    segments,
    session,
  ]);

  const value = useMemo(() => ({ pendingIntent }), [pendingIntent]);
  return (
    <NotificationIntentContext.Provider value={value}>
      {children}
    </NotificationIntentContext.Provider>
  );
}

export function useNotificationIntent(): NotificationIntentContextValue {
  const value = useContext(NotificationIntentContext);
  if (!value) {
    throw new Error(
      "useNotificationIntent muss innerhalb des NotificationIntentProvider verwendet werden.",
    );
  }
  return value;
}