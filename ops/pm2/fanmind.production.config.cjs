"use strict";

const currentReleaseLink = process.env.FANMIND_CURRENT_RELEASE_LINK;
const releaseCommit = process.env.FANMIND_RELEASE_COMMIT;
const appName = process.env.FANMIND_PM2_APP_NAME || "fanmind";

if (!currentReleaseLink || !currentReleaseLink.startsWith("/")) {
  throw new Error("FANMIND_CURRENT_RELEASE_LINK must be an absolute path");
}

if (!/^[0-9a-f]{40}$/.test(releaseCommit || "")) {
  throw new Error("FANMIND_RELEASE_COMMIT must be a full commit SHA");
}

module.exports = {
  apps: [
    {
      name: appName,
      cwd: currentReleaseLink,
      script: "node_modules/next/dist/bin/next",
      args: ["start"],
      instances: 1,
      exec_mode: "cluster",
      listen_timeout: 30_000,
      kill_timeout: 30_000,
      merge_logs: true,
      filter_env: true,
      env: {
        NODE_ENV: "production",
        FANMIND_RUNTIME_ENVIRONMENT: "production",
        FANMIND_RELEASE_COMMIT: releaseCommit,
        FANMIND_CHAT_ADMIN_CHARACTER_FANS_ENABLED: "true",
      },
    },
  ],
};
