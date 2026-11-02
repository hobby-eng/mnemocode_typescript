/** Run the remaining audit checks sequentially while the caller holds the shared heavy lock. */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const checks = [
  ["dependencies-frozen", ["pnpm", "install", "--frozen-lockfile", "--offline"]],
  ["self-test", ["node", "dist/mnemocode.js", "self-test"]],
  ["pty", ["python3", "scripts/verify-terminal-input.py"]],
  ["card-output", ["node", "scripts/check-card-output.mjs", "output/aud039-card-output"]],
  ["sskr-canonical", ["pnpm", "verify:sskr"]],
  ["executable-build", ["node", "scripts/build-executable.mjs", "output/aud039-candidate"]],
  ["executable-verify", ["node", "scripts/verify-executable.mjs", "output/aud039-candidate"]],
  ["executable-pty", ["python3", "scripts/verify-terminal-input.py", join(root, "output/aud039-candidate/mnemocode-0.1.0-linux-x64")]],
  ["suite-two", ["pnpm", "exec", "vitest", "run", "--maxWorkers=2", "--reporter=dot"]],
];
let failures = 0;
let executableBuilt = false;
for (const [label, command] of checks) {
  if (["executable-verify", "executable-pty"].includes(label) && !executableBuilt) {
    console.log(JSON.stringify({ skippedLabel: label, reason: "No successful candidate build in this schedule." }));
    continue;
  }
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["docs/audits/AUD-039-harnesses/run.mjs", label, ...command], {
      cwd: root,
      env: label === "suite-two" ? { ...process.env, AUD039_RSS_MIB: "2304", AUD039_TIMEOUT_SECONDS: "3600" } : process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (status) => done(status ?? 125));
  });
  failures += Number(code !== 0);
  console.log(JSON.stringify({ completedLabel: label, exit: code }));
  if (label === "executable-build") executableBuilt = code === 0;
  if (label === "dependencies-frozen" && code !== 0) break;
}
process.exitCode = failures ? 1 : 0;
