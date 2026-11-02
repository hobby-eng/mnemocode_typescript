/** Capture the current checkout for a fresh AUD-039 replay without replacing earlier evidence. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const EVIDENCE = join(ROOT, "docs/audits/AUD-039-evidence");
const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const files = git("ls-files", "-z")
  .split("\0")
  .filter(Boolean)
  .sort()
  .map((path) => {
    const bytes = readFileSync(join(ROOT, path));
    return { path, sha256: hash(bytes), bytes: bytes.length, kind: bytes.includes(0) ? "binary" : "text" };
  });
const snapshot = {
  auditId: "AUD-039",
  reservedUtc: new Date().toISOString(),
  repository: "hobby-eng/mnemocode_typescript",
  commit: git("rev-parse", "HEAD").trim(),
  workingTree: git("status", "--porcelain"),
  sourceVersion: packageJson.version,
  sourceFingerprint: hash(JSON.stringify(files.map(({ path, sha256 }) => ({ path, sha256 })))),
  files,
  replayQualification: "These are the bytes of this replay, not automatically the original AUD-039 snapshot.",
};
mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(join(EVIDENCE, "snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ commit: snapshot.commit, files: files.length, sourceFingerprint: snapshot.sourceFingerprint }));
