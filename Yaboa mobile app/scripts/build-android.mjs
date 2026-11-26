import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const isWindows = process.platform === "win32";
const wrapper = resolve("android", isWindows ? "gradlew.bat" : "gradlew");
const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, "Android", "Sdk") : "",
  process.env.HOME ? resolve(process.env.HOME, "Android", "Sdk") : "",
].filter(Boolean);
const sdkPath = sdkCandidates.find((path) => existsSync(path));
const env = { ...process.env };
if (sdkPath) {
  env.ANDROID_HOME ||= sdkPath;
  env.ANDROID_SDK_ROOT ||= sdkPath;
}

const options = { cwd: resolve("android"), stdio: "inherit", env };
const result = isWindows
  ? spawnSync(`"${wrapper}" assembleDebug`, { ...options, shell: true })
  : spawnSync(wrapper, ["assembleDebug"], options);

if (result.error) {
  console.error(`Could not start Gradle: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
