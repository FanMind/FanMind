"use client";

import { useEffect } from "react";
import { readWebRegistrationSession } from "@/lib/webRegistrationPolicy.mjs";

// Supabase may return an email-confirmed user to its configured Site URL.
// Recover that supported signup callback without changing Auth configuration.
export function RegistrationCallbackRedirect() {
  useEffect(() => {
    function resume() {
      if (!["/", "/login"].includes(window.location.pathname)) return;
      if (!readWebRegistrationSession(window.location)) return;
      window.location.replace(`/register/confirm${window.location.search}${window.location.hash}`);
    }
    resume();
    window.addEventListener("hashchange", resume);
    return () => window.removeEventListener("hashchange", resume);
  }, []);
  return null;
}
