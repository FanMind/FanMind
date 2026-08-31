import { usePathname, useRouter, useSegments } from "expo-router";
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
  const [pendingIntent, setPendingIntent] = useState<NotificationIntent | null>(
    null,
  );
  const pendingIdentifier = useRef<string | null>(null);
  const consumedIdentifiers = useRef<string[]>([]);

  const acceptIntent = useCallback((intent: NotificationIntent) => {
    if (
      pendingIdentifier.current === intent.responseIdentifier ||
      consumedIdentifiers.current.includes(intent.responseIdentifier)
    ) {
      return;
    }
    pendingIdentifier.current = intent.responseIdentifier;
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
    const decision = decideNotificationIntent({
      authLoading: loading,
      hasSession: Boolean(session),
      segments,
      pathname,
      pendingIntent,
    });
    if (decision === "navigate" && pendingIntent) {
      router.replace(pendingIntent.route);
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
    setPendingIntent((current) =>
      current?.responseIdentifier === responseIdentifier ? null : current,
    );
    try {
      clearLastNotificationIntent();
    } catch {
      // Native cleanup is best effort. In-memory consumption must still stop
      // a stale native response from trapping navigation on its destination.
    }
  }, [loading, pathname, pendingIntent, router, segments, session]);

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
