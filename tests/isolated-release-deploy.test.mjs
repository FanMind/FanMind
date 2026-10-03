import assert from "node:assert/strict";
import test from "node:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scriptPath = "scripts/operations/deploy-isolated-release.sh";
const workflowPath = ".github/workflows/deploy-fanmind.yml";
const pm2ConfigPath = "ops/pm2/fanmind.production.config.cjs";
const require = createRequire(import.meta.url);

function position(text, value) {
  const result = text.indexOf(value);
  assert.notEqual(result, -1, `Expected marker not found: ${value}`);
  return result;
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
  return result;
}

async function writeExecutable(path, body) {
  await writeFile(path, body);
  await chmod(path, 0o755);
}

test("isolated deployment shell script has valid Bash syntax", () => {
  const result = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("release is built and verified before PM2 switches away from the live cwd", async () => {
  const script = await readFile(scriptPath, "utf8");
  const archive = position(script, 'git archive --format=tar "$RELEASE_COMMIT"');
  const install = position(script, "npm ci --no-audit --no-fund");
  const truth = position(script, "npm run verify:truth");
  const lint = position(script, "npm run lint");
  const tests = position(script, "npm run test:operations");
  const build = position(script, 'NEXT_DEPLOYMENT_ID="$RELEASE_COMMIT" npm run build');
  const deploymentId = position(
    script,
    'verify_built_deployment_id "$RELEASE_DIR" "$RELEASE_COMMIT"',
  );
  const switchLink = position(script, 'switch_current_link "$RELEASE_DIR"');
  const switchProcess = script.lastIndexOf(
    'reload_pm2_cluster "$RELEASE_DIR/$PM2_CONFIG_RELATIVE_PATH"',
  );
  assert.notEqual(switchProcess, -1);

  assert.ok(archive < install);
  assert.ok(install < truth);
  assert.ok(truth < lint);
  assert.ok(lint < tests);
  assert.ok(tests < build);
  assert.ok(build < deploymentId);
  assert.ok(deploymentId < switchLink);
  assert.ok(switchLink < switchProcess);
});

test("rolling deployment binds Next.js version-skew protection to the exact release", async () => {
  const [script, runbook] = await Promise.all([
    readFile(scriptPath, "utf8"),
    readFile("docs/operations/ISOLATED_RELEASE_DEPLOY.md", "utf8"),
  ]);

  assert.match(
    script,
    /NEXT_DEPLOYMENT_ID="\$RELEASE_COMMIT" npm run build/u,
  );
  assert.match(
    script,
    /payload\?\.config\?\.deploymentId === process\.env\.FANMIND_REQUIRED_DEPLOYMENT_ID/u,
  );
  assert.match(
    runbook,
    /Next\.js deployment identifier/u,
  );
  assert.match(runbook, /version skew/iu);
});

test("production Next.js config accepts only a full release commit as deployment ID", () => {
  const releaseCommit = "1".repeat(40);
  const configProbe = `
    import configModule from "next/dist/server/config.js";
    const loadConfig = configModule.default;
    const config = await loadConfig("phase-production-build", process.cwd(), { silent: true });
    if (config.deploymentId !== process.env.NEXT_DEPLOYMENT_ID) process.exit(9);
  `;

  const accepted = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", configProbe],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, NEXT_DEPLOYMENT_ID: releaseCommit },
    },
  );
  assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);

  const rejected = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", configProbe],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, NEXT_DEPLOYMENT_ID: "not-a-release-commit" },
    },
  );
  assert.notEqual(rejected.status, 0);
  assert.match(
    `${rejected.stderr}\n${rejected.stdout}`,
    /NEXT_DEPLOYMENT_ID must be a full lowercase Git commit SHA/u,
  );
});

test("release switch is continuously probed without retaining response data", async () => {
  const script = await readFile(scriptPath, "utf8");
  const probeStart = position(script, "start_availability_probe");
  const switchLink = position(script, 'switch_current_link "$RELEASE_DIR"');
  const probeVerify = script.lastIndexOf("verify_availability_probe");

  assert.ok(probeStart < switchLink);
  assert.ok(switchLink < probeVerify);
  assert.match(script, /"\$BASE_URL\/api\/version"/u);
  assert.match(script, /chmod 0600 "\$AVAILABILITY_LOG"/u);
  assert.match(script, /\$0 != "200"/u);
  assert.match(script, /sample_count >= 2/u);
  assert.match(
    script,
    /rollback "release switch availability probe detected an outage"/u,
  );
  assert.doesNotMatch(
    script,
    /AVAILABILITY_LOG[\s\S]{0,160}(?:response body|Authorization|Cookie)/iu,
  );
});

test("failed health or smoke checks invoke rollback before failure", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /rollback "login healthcheck failed"/);
  assert.match(script, /rollback "public smoke test failed"/);
  assert.match(script, /PREVIOUS_CWD/);
  assert.match(script, /PREVIOUS_LINK_TARGET/);
  assert.match(script, /previous release link could not be restored/);
  assert.match(script, /rolling rollback completed to previous release/);
  assert.match(script, /pm2 start npm --name "\$APP_NAME" --cwd "\$PREVIOUS_CWD" -- start/);
  assert.match(script, /git reset --hard "\$RELEASE_COMMIT"/);
  assert.match(script, /unexpected failure after PM2 switched to the new release/);
});

test("every production start and smoke gate is bound to the production runtime", async () => {
  const [script, workflow] = await Promise.all([
    readFile(scriptPath, "utf8"),
    readFile(workflowPath, "utf8"),
  ]);

  assert.match(
    script,
    /FANMIND_RELEASE_COMMIT="\$commit"[\s\S]*?FANMIND_CURRENT_RELEASE_LINK="\$CURRENT_LINK"[\s\S]*?pm2 start "\$config_path"/,
  );
  assert.match(
    script,
    /FANMIND_RELEASE_COMMIT="\$rollback_commit"[\s\S]*?FANMIND_RUNTIME_ENVIRONMENT=production[\s\S]*?pm2 start npm --name "\$APP_NAME" --cwd "\$PREVIOUS_CWD" -- start/,
  );
  assert.match(
    script,
    /FANMIND_RELEASE_COMMIT="\$rollback_commit"[\s\S]*?FANMIND_RUNTIME_ENVIRONMENT=production[\s\S]*?pm2 start npm --name "\$APP_NAME" --cwd "\$SOURCE_DIR" -- start/,
  );
  assert.match(
    script,
    /FANMIND_EXPECTED_RELEASE_COMMIT="\$RELEASE_COMMIT"[\s\S]*?FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production[\s\S]*?npm run smoke:public/,
  );
  assert.match(
    workflow,
    /FANMIND_RELEASE_COMMIT="\$RELEASE_COMMIT"[\s\S]*?FANMIND_RUNTIME_ENVIRONMENT=production[\s\S]*?pm2 start npm --name fanmind --cwd "\$SOURCE_DIR" -- start/,
  );
  assert.match(
    workflow,
    /FANMIND_EXPECTED_RELEASE_COMMIT="\$RELEASE_COMMIT"[\s\S]*?FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production[\s\S]*?npm run smoke:public/,
  );
});

test("plaintext environment stays shared and releases are retained safely", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(
    script,
    /ln -s "\$SOURCE_DIR\/\.env\.production" "\$TEMP_RELEASE\/\.env\.production"/,
  );
  assert.match(script, /FANMIND_RELEASE_RETENTION_COUNT:-4/);
  assert.match(script, /is_safe_release_path/);
  assert.doesNotMatch(script, /cat .*\.env\.production/);
});

test("current release link is updated atomically with the required privilege", async () => {
  const script = await readFile(scriptPath, "utf8");
  const removeTempLink = position(script, 'sudo rm -f -- "${CURRENT_LINK}.new"');
  const createTempLink = position(script, 'sudo ln -s "$target" "${CURRENT_LINK}.new"');
  const replaceCurrentLink = position(script, 'sudo mv -Tf "${CURRENT_LINK}.new" "$CURRENT_LINK"');

  assert.ok(removeTempLink < createTempLink);
  assert.ok(createTempLink < replaceCurrentLink);
});

test("PM2 production contract uses one rolling cluster worker on the stable release link", () => {
  const previousEnv = {
    FANMIND_CURRENT_RELEASE_LINK: process.env.FANMIND_CURRENT_RELEASE_LINK,
    FANMIND_RELEASE_COMMIT: process.env.FANMIND_RELEASE_COMMIT,
    FANMIND_PM2_APP_NAME: process.env.FANMIND_PM2_APP_NAME,
  };

  process.env.FANMIND_CURRENT_RELEASE_LINK = "/var/www/fanmind-current";
  process.env.FANMIND_RELEASE_COMMIT = "a".repeat(40);
  process.env.FANMIND_PM2_APP_NAME = "fanmind";
  const configModule = require.resolve(`../${pm2ConfigPath}`);
  delete require.cache[configModule];
  const config = require(configModule);

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  assert.equal(config.apps.length, 1);
  assert.deepEqual(
    {
      name: config.apps[0].name,
      cwd: config.apps[0].cwd,
      script: config.apps[0].script,
      instances: config.apps[0].instances,
      execMode: config.apps[0].exec_mode,
      listenTimeout: config.apps[0].listen_timeout,
      killTimeout: config.apps[0].kill_timeout,
      filterEnv: config.apps[0].filter_env,
    },
    {
      name: "fanmind",
      cwd: "/var/www/fanmind-current",
      script: "node_modules/next/dist/bin/next",
      instances: 1,
      execMode: "cluster",
      listenTimeout: 30_000,
      killTimeout: 30_000,
      filterEnv: true,
    },
  );
  assert.equal(config.apps[0].env.FANMIND_RUNTIME_ENVIRONMENT, "production");
  assert.equal(config.apps[0].env.FANMIND_RELEASE_COMMIT, "a".repeat(40));
  assert.equal(
    config.apps[0].env.FANMIND_CHAT_ADMIN_CHARACTER_FANS_ENABLED,
    "true",
  );
});

test("legacy migration is followed by a delete-free rolling release in an executed harness", async (t) => {
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

  runChecked("git", ["init", "-b", "main"], { cwd: seed });
  runChecked("git", ["config", "user.name", "FanMind Test"], { cwd: seed });
  runChecked("git", ["config", "user.email", "fanmind-test@example.invalid"], { cwd: seed });
  runChecked("git", ["add", "."], { cwd: seed });
  runChecked("git", ["commit", "-m", "initial release"], { cwd: seed });
  const firstCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: seed }).stdout.trim();
  runChecked("git", ["clone", "--bare", seed, remote]);
  runChecked("git", ["clone", remote, source]);
  runChecked("git", ["remote", "add", "origin", remote], { cwd: seed });
  await writeFile(join(source, ".env.production"), "FANMIND_TEST_ONLY=true\n");

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
if [[ "\${1:-}" == "run" ]] && [[ "\${2:-}" == "build" ]]; then
  mkdir -p .next
  printf '{"config":{"deploymentId":"%s"}}\\n' "$NEXT_DEPLOYMENT_ID" > .next/required-server-files.json
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
    PATH: `${fakeBin}:${process.env.PATH}`,
    FANMIND_SOURCE_DIR: source,
    FANMIND_RELEASE_ROOT: releaseRoot,
    FANMIND_CURRENT_RELEASE_LINK: currentLink,
    FANMIND_DEPLOY_BASE_URL: "https://fanmind.invalid",
    FAKE_PM2_STATE: pm2State,
    FAKE_PM2_ACTIONS: pm2Actions,
    FAKE_LIVE_COMMIT: "0".repeat(40),
  };

  const firstDeploy = runChecked("bash", [deployScript, firstCommit], { env: baseEnv });
  assert.match(firstDeploy.stdout, /migrating legacy PM2 process/u);
  assert.equal(await readlink(currentLink), join(releaseRoot, firstCommit));
  const firstActions = await readFile(pm2Actions, "utf8");
  assert.match(firstActions, /^jlist\njlist\ndelete\nstart\njlist\nsave\n/m);

  await writeFile(join(seed, "release-marker.txt"), "second release\n");
  runChecked("git", ["add", "release-marker.txt"], { cwd: seed });
  runChecked("git", ["commit", "-m", "second release"], { cwd: seed });
  const secondCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: seed }).stdout.trim();
  runChecked("git", ["push", "origin", "main"], { cwd: seed });

  const actionBoundary = (await readFile(pm2Actions, "utf8")).length;
  const secondDeploy = runChecked("bash", [deployScript, secondCommit], {
    env: {
      ...baseEnv,
      FAKE_LIVE_COMMIT: firstCommit,
    },
  });
  assert.match(secondDeploy.stdout, /switching release with PM2 rolling reload/u);
  assert.equal(await readlink(currentLink), join(releaseRoot, secondCommit));

  const secondActions = (await readFile(pm2Actions, "utf8")).slice(actionBoundary);
  assert.match(secondActions, /reload\n/u);
  assert.doesNotMatch(secondActions, /delete\n/u);
  assert.doesNotMatch(secondActions, /start\n/u);

  const finalState = JSON.parse(await readFile(pm2State, "utf8"));
  assert.equal(finalState.processes.length, 1);
  assert.equal(finalState.processes[0].pm2_env.exec_mode, "cluster_mode");
  assert.equal(finalState.processes[0].pm2_env.pm_cwd, currentLink);
  assert.equal(
    finalState.processes[0].pm2_env.FANMIND_RELEASE_COMMIT,
    secondCommit,
  );

  await writeFile(join(seed, "release-marker.txt"), "failing third release\n");
  runChecked("git", ["add", "release-marker.txt"], { cwd: seed });
  runChecked("git", ["commit", "-m", "third release"], { cwd: seed });
  const thirdCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: seed }).stdout.trim();
  runChecked("git", ["push", "origin", "main"], { cwd: seed });

  const failOnceMarker = join(root, "fail-reload-once");
  const failedDeploy = spawnSync("bash", [deployScript, thirdCommit], {
    encoding: "utf8",
    env: {
      ...baseEnv,
      FAKE_LIVE_COMMIT: secondCommit,
      FAKE_PM2_FAIL_RELOAD_ONCE: failOnceMarker,
    },
  });
  assert.notEqual(failedDeploy.status, 0);
  assert.match(failedDeploy.stdout, /rolling rollback completed to previous release/u);
  assert.equal(await readlink(currentLink), join(releaseRoot, secondCommit));

  const rolledBackState = JSON.parse(await readFile(pm2State, "utf8"));
  assert.equal(
    rolledBackState.processes[0].pm2_env.FANMIND_RELEASE_COMMIT,
    secondCommit,
  );

  const availabilityFailureMarker = join(root, "fail-availability-after-first");
  const unavailableDeploy = spawnSync("bash", [deployScript, thirdCommit], {
    encoding: "utf8",
    env: {
      ...baseEnv,
      FAKE_LIVE_COMMIT: secondCommit,
      FAKE_AVAILABILITY_FAIL_AFTER_FIRST: availabilityFailureMarker,
    },
  });
  assert.notEqual(unavailableDeploy.status, 0);
  assert.match(
    unavailableDeploy.stdout,
    /release switch availability: samples=\d+ non_200=1/u,
  );
  assert.match(
    unavailableDeploy.stdout,
    /rolling rollback completed to previous release/u,
  );
  assert.equal(await readlink(currentLink), join(releaseRoot, secondCommit));

  const availabilityRolledBackState = JSON.parse(
    await readFile(pm2State, "utf8"),
  );
  assert.equal(
    availabilityRolledBackState.processes[0].pm2_env.FANMIND_RELEASE_COMMIT,
    secondCommit,
  );
});

test("steady-state release switch reloads without deleting the live PM2 process", async () => {
  const script = await readFile(scriptPath, "utf8");
  const rollingBranch = script.match(
    /if pm2_uses_rolling_release_contract; then([\s\S]*?)else/,
  )?.[1];

  assert.ok(rollingBranch);
  assert.match(rollingBranch, /PM2 rolling reload/u);
  assert.match(rollingBranch, /reload_pm2_cluster/);
  assert.doesNotMatch(rollingBranch, /pm2 delete/);
  assert.match(script, /pm2 reload "\$config_path" --only "\$APP_NAME" --update-env/);
});

test("deploy verifies PM2 mode, stable cwd and exact release environment", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /matches\.length === 1/);
  assert.match(script, /exec_mode === "cluster_mode"/);
  assert.match(script, /pm_cwd === process\.env\.FANMIND_EXPECTED_PM2_CWD/);
  assert.match(
    script,
    /FANMIND_RELEASE_COMMIT === process\.env\.FANMIND_EXPECTED_RELEASE_COMMIT/,
  );
  assert.match(script, /rollback "PM2 release contract verification failed"/);
});

test("active and previous symlink targets are protected from rebuild and retention cleanup", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(
    script,
    /\[\[ "\$PREVIOUS_CWD" == "\$RELEASE_DIR" \]\] \|\| \[\[ "\$PREVIOUS_LINK_TARGET" == "\$RELEASE_DIR" \]\]/,
  );
  assert.match(
    script,
    /\[\[ "\$candidate" == "\$PREVIOUS_LINK_TARGET" \]\]/,
  );
});

test("production workflow keeps isolated deployment explicitly disabled by default", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /ISOLATED_DEPLOY_ENABLED="false"/);
  assert.match(workflow, /FANMIND_ENABLE_ISOLATED_RELEASE_DEPLOY/);
  assert.match(workflow, /if \[ "\$ISOLATED_DEPLOY_ENABLED" = "true" \]/);
  assert.match(workflow, /deploy-isolated-release\.sh/);
  assert.match(
    workflow,
    /Using legacy in-place deployment because isolated release deployment is disabled/,
  );
  assert.match(workflow, /git reset --hard "\$RELEASE_COMMIT"/);
  assert.match(workflow, /pm2 start npm --name fanmind --cwd "\$SOURCE_DIR" -- start/);
});

test("production deploy is pinned to the immutable triggering commit", async () => {
  const [workflow, script, runbook] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
    readFile("docs/operations/ISOLATED_RELEASE_DEPLOY.md", "utf8"),
  ]);

  assert.match(workflow, /EXPECTED_RELEASE_COMMIT: \$\{\{ github\.sha \}\}/u);
  assert.match(workflow, /RELEASE_COMMIT="\$EXPECTED_RELEASE_COMMIT"/u);
  assert.match(
    workflow,
    /git merge-base --is-ancestor "\$EXPECTED_RELEASE_COMMIT" origin\/main/u,
  );
  assert.doesNotMatch(
    workflow,
    /RELEASE_COMMIT="\$\(git rev-parse origin\/main\)"/u,
  );
  assert.doesNotMatch(workflow, /git reset --hard origin\/main/u);
  assert.match(
    script,
    /git merge-base --is-ancestor "\$RELEASE_COMMIT" origin\/main/u,
  );
  assert.doesNotMatch(
    script,
    /git rev-parse origin\/main.*==.*RELEASE_COMMIT/u,
  );
  assert.match(runbook, /immutable commit that triggered the workflow/iu);
});

test("rollback failures fall through to the next safe target and live version lookup is optional", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /PREVIOUS_COMMIT="\$\(read_live_commit \|\| true\)"/);
  assert.match(script, /if FANMIND_RELEASE_COMMIT="\$rollback_commit"[\s\S]*FANMIND_RUNTIME_ENVIRONMENT=production[\s\S]*pm2 start npm --name "\$APP_NAME" --cwd "\$PREVIOUS_CWD" -- start; then/);
  assert.match(script, /previous cwd could not be started; trying source checkout fallback/);
  assert.match(script, /source checkout fallback could not be started/);
  assert.match(script, /manual intervention required/);
});
