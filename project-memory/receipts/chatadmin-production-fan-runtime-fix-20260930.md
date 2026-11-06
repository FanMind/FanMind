# ChatAdmin Production Fan Runtime Fix — 2026-09-30

Owner validation showed that Production still rendered the legacy Character-only composer although the fan schema, capability and deployment workflow activation were present.

Root cause: the isolated Production PM2 configuration uses `filter_env: true` but did not include `FANMIND_CHAT_ADMIN_CHARACTER_FANS_ENABLED` in its explicit application environment. The workflow export therefore did not reach the running Next.js process.

The bounded fix adds the already approved value `true` to the capability-gated Production PM2 environment and adds a regression assertion to the rolling-deployment contract. Workspace authorization, database capability checks, manual copy/send behavior and all no-auto-send boundaries remain unchanged.

Local verification before publication: isolated deployment tests 17/17; focused ChatAdmin policy/API tests 29/29; ESLint quiet pass; Next.js Production build pass.
