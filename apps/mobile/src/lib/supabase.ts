import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { getMobileEnvironment } from "@/lib/env";
import { secureSessionStorage } from "@/lib/secureStorage";

const environment = getMobileEnvironment();

export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      headers: {
        "X-Client-Info": "fanmind-mobile/0.1.0",
      },
    },
  },
);
