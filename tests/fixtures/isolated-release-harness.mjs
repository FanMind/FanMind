import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const scriptPath = 'scripts/operations/deploy-isolated-release.sh';
const pm2ConfigPath = 'ops/pm2/fanmind.production.config.cjs';
function runChecked(command,args,options={}) { const r=spawnSync(command,args,{encoding:'utf8',...options}); assert.equal(r.status,0,r.stdout+r.stderr);return r; }
async function writeExecutable(path,body) { await writeFile(path,body); await chmod(path,0o755); }
export async function withIsolatedReleaseHarness(t, callback) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-rolling-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const seed = join(root, "seed");
  const remote = join(root, "remote.git");
  const source = join(root, "source");
  const releaseRoot = join(root, "releases");
  const currentLink = join(root, "current");
  const fakeBin = join(root, "bin");
  const pm2State = join(root, "pm2-state.json");
  const pm2Actions = join(root, "pm2-actions.log");
  const operationsHeads = join(root, "operations-heads.log");
  const deployScript = join(process.cwd(), scriptPath);

  await mkdir(join(seed, "scripts", "operations"), { recursive: true });
  await mkdir(join(seed, "ops", "pm2"), { recursive: true });
  await mkdir(fakeBin, { recursive: true });
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(join(seed, "package.json"), '{"name":"deploy-harness","private":true}\n');
  await writeFile(
    join(seed, "scripts", "operations", "deploy-isolated-release.sh"),
    await readFile(scriptPath),
  );
  await writeFile(
    join(seed, pm2ConfigPath),
    await readFile(pm2ConfigPath),
  );

  await writeFile(join(seed, "ops/pm2/support-runtime-setting.cjs"), await readFile("ops/pm2/support-runtime-setting.cjs"));

  runChecked("git", ["init", "-b", "main"], { cwd: seed });
  runChecked("git", ["config", "user.name", "FanMind Test"], { cwd: seed });
  runChecked("git", ["config", "user.email", "fanmind-test@example.invalid"], { cwd: seed });
  runChecked("git", ["add", "."], { cwd: seed });
  runChecked("git", ["commit", "-m", "initial release"], { cwd: seed });
  const firstCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: seed }).stdout.trim();
  runChecked("git", ["clone", "--bare", seed, remote]);
  runChecked("git", ["clone", remote, source]);
  runChecked("git", ["remote", "add", "origin", remote], { cwd: seed });
  await writeFile(join(source, ".env.production"), "FANMIND_TEST_ONLY=true\nFANMIND_SUPPORT_CENTRE_ENABLED=true\n");

  const oldRelease = join(releaseRoot, "0".repeat(40));
  await mkdir(join(oldRelease, ".next"), { recursive: true });
  await writeFile(join(oldRelease, "package.json"), '{"name":"old-release"}\n');
  await symlink(oldRelease, currentLink);
  await writeFile(
    pm2State,
    JSON.stringify({
      processes: [
        {
          name: "fanmind",
          pm2_env: {
            status: "online",
            exec_mode: "fork_mode",
            pm_cwd: oldRelease,
            FANMIND_RELEASE_COMMIT: "0".repeat(40),
            FANMIND_RUNTIME_ENVIRONMENT: "production",
          },
        },
      ],
    }),
  );

  await writeExecutable(
    join(fakeBin, "pm2"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const statePath = process.env.FAKE_PM2_STATE;
const actionsPath = process.env.FAKE_PM2_ACTIONS;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const action = args[0] || "";
fs.appendFileSync(actionsPath, action + "\\n");
if (action === "reload" && process.env.FAKE_PM2_FAIL_RELOAD_ONCE) {
  const marker = process.env.FAKE_PM2_FAIL_RELOAD_ONCE;
  if (!fs.existsSync(marker)) {
    fs.writeFileSync(marker, "failed\\n");
    process.exit(1);
  }
}
if (action === "jlist") {
  process.stdout.write(JSON.stringify(state.processes));
  process.exit(0);
}
if (action === "delete") {
  state.processes = [];
} else if (action === "start" || action === "reload") {
  const config = require(args[1]);
  const app = config.apps[0];
  state.processes = [{
    name: app.name,
    pm2_env: {
      status: "online",
      exec_mode: "cluster_mode",
      pm_cwd: app.cwd,
      FANMIND_RELEASE_COMMIT: app.env.FANMIND_RELEASE_COMMIT,
      FANMIND_RUNTIME_ENVIRONMENT: app.env.FANMIND_RUNTIME_ENVIRONMENT,
      FANMIND_SUPPORT_CENTRE_ENABLED: app.env.FANMIND_SUPPORT_CENTRE_ENABLED,
    },
  }];
}
fs.writeFileSync(statePath, JSON.stringify(state));
`,
  );
  await writeExecutable(
    join(fakeBin, "npm"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "run" ]] && [[ "\${2:-}" == "test:operations" ]]; then
  [[ -d .git && ! -e .env.production ]]
  [[ "$PWD" != "$FANMIND_SOURCE_DIR" ]]
  git rev-parse HEAD >> "$FAKE_OPERATIONS_HEADS"
  [[ -z "\${FAKE_OPERATIONS_FAIL:-}" ]]
fi
if [[ "\${1:-}" == "run" ]] && [[ "\${2:-}" == "build" ]]; then
  [[ ! -e .git ]]
  mkdir -p .next
  printf '{"config":{"deploymentId":"%s"}}\\n' "$NEXT_DEPLOYMENT_ID" > .next/required-server-files.json
  printf '%s' "\${NEXT_PUBLIC_FANMIND_INAPP_HELP_ENABLED:-}" > .next/help-build.txt
fi
`,
  );
  await writeExecutable(
    join(fakeBin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"%{http_code}"* ]]; then
  if [[ -n "\${FAKE_AVAILABILITY_FAIL_AFTER_FIRST:-}" ]]; then
    if [[ ! -e "$FAKE_AVAILABILITY_FAIL_AFTER_FIRST" ]]; then
      printf 'first\\n' > "$FAKE_AVAILABILITY_FAIL_AFTER_FIRST"
    elif [[ ! -e "\${FAKE_AVAILABILITY_FAIL_AFTER_FIRST}.failed" ]]; then
      printf 'failed\\n' > "\${FAKE_AVAILABILITY_FAIL_AFTER_FIRST}.failed"
      printf '502'
      exit 0
    fi
  fi
  printf '200'
  exit 0
fi
if [[ "$*" == *"/api/version"* ]]; then
  printf '{"releaseCommit":"%s"}\\n' "$FAKE_LIVE_COMMIT"
fi
`,
  );
  await writeExecutable(
    join(fakeBin, "sudo"),
    "#!/usr/bin/env bash\nset -euo pipefail\nexec \"$@\"\n",
  );
  await writeExecutable(
    join(fakeBin, "nginx"),
    "#!/usr/bin/env bash\nexit 0\n",
  );

  const baseEnv = {
    ...process.env,
    // Each synthetic scenario owns this setting; never inherit the real deploy guard.
    FANMIND_REQUIRE_SUPPORT_DISABLED: "false",
    FANMIND_SUPPORT_HELP_BUILD_ENABLE: "false",
    PATH: `${fakeBin}:${process.env.PATH}`,
    FANMIND_SOURCE_DIR: source,
    FANMIND_RELEASE_ROOT: releaseRoot,
    FANMIND_CURRENT_RELEASE_LINK: currentLink,
    FANMIND_DEPLOY_BASE_URL: "https://fanmind.invalid",
    FAKE_PM2_STATE: pm2State,
    FAKE_PM2_ACTIONS: pm2Actions,
    FAKE_OPERATIONS_HEADS: operationsHeads,
    FAKE_LIVE_COMMIT: "0".repeat(40),
  };

  return callback({ root, seed, remote, source, releaseRoot, currentLink, fakeBin, pm2State, pm2Actions, operationsHeads, deployScript, oldRelease, baseEnv, firstCommit });
}
