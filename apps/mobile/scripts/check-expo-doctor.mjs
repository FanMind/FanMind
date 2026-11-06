import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDirectory, "..");
const expoCli = resolve(mobileRoot, "node_modules/expo/bin/cli");
const expoDoctor = resolve(
  mobileRoot,
  "node_modules/expo-doctor/bin/expo-doctor.js",
);

function commandSucceeded(result) {
  return result?.status === 0 && result?.signal == null && result?.error == null;
}

export function runExpoDoctorGate({ runConfig, runDoctor }) {
  const configResult = runConfig();
  if (!commandSucceeded(configResult)) {
    return { ok: false, code: "expo_config_failed" };
  }

  const doctorResult = runDoctor();
  if (!commandSucceeded(doctorResult)) {
    return { ok: false, code: "expo_doctor_failed" };
  }

  return { ok: true, code: "success" };
}

function main() {
  const environment = {
    ...process.env,
    EXPO_NO_TELEMETRY: "1",
  };
  const result = runExpoDoctorGate({
    runConfig: () =>
      spawnSync(
        process.execPath,
        [expoCli, "config", "--json", "--full"],
        {
          cwd: mobileRoot,
          env: environment,
          stdio: ["ignore", "ignore", "ignore"],
        },
      ),
    runDoctor: () =>
      spawnSync(process.execPath, [expoDoctor], {
        cwd: mobileRoot,
        env: environment,
        stdio: "inherit",
      }),
  });

  if (!result.ok) {
    process.stderr.write(`MOBILE_EXPO_DOCTOR=${result.code}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write("MOBILE_EXPO_DOCTOR=success\n");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
