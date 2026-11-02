// Records this program's known answers as data (DOC-04) for the tests of its Rust port to replay
// (RUST-14): every recorder of scripts/rust-parity/ runs against this repository's build (dist/,
// which `pnpm build` makes first) and returns one JSON file, written into the Rust repository's
// vectors folder with PROVENANCE.json: the commit, Node.js, and the SHA-256 of every recorder and
// every file. The working tree must be clean, so that the commit names the code that answered. A
// recorder reads the build's own modules with public inputs only. The Rust repository checks the
// files against PROVENANCE.json (its `cargo xtask code-rules`).
//
//   pnpm record:rust-parity <vectors-folder>           write every file
//   pnpm record:rust-parity <vectors-folder> --check   fail if a file would change
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const RECORDERS = join(root, "scripts", "rust-parity");
const PROVENANCE = "PROVENANCE.json";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

/** One recorded file's bytes: the data as JSON, one value per line where it is an array. */
function serialize(data) {
  return `${JSON.stringify(data, null, 1)}\n`;
}

/** The recorders, by file name, sorted. */
function recorders() {
  return readdirSync(RECORDERS)
    .filter((name) => name.endsWith(".mjs"))
    .sort();
}

const [folder, flag] = process.argv.slice(2);
const check = flag === "--check";
if (folder === undefined || (flag !== undefined && !check) || process.argv.length > 4) {
  process.stderr.write("usage: pnpm record:rust-parity <vectors-folder> [--check]\n");
  process.exit(2);
}
if (git("status", "--porcelain") !== "") {
  process.stderr.write(
    "The working tree has changes: commit them, so that the commit names the code.\n",
  );
  process.exit(1);
}
const commit = git("rev-parse", "HEAD");
const output = resolve(folder);
const ts = {
  root,
  /** A module of the build, by its path under dist/. */
  load: (path) => import(pathToFileURL(join(root, "dist", path)).href),
};
const outputs = {};
const recorded = {};
const changed = [];
mkdirSync(output, { recursive: true });
for (const name of recorders()) {
  const recorder = await import(pathToFileURL(join(RECORDERS, name)).href);
  recorded[name] = sha256(readFileSync(join(RECORDERS, name)));
  // A part of another recorder, such as recovery-shares.mjs, records nothing of its own.
  if (recorder.record === undefined) continue;
  const bytes = serialize(await recorder.record(ts));
  const path = join(output, recorder.FILE);
  if (check && (!existsSync(path) || readFileSync(path, "utf8") !== bytes))
    changed.push(recorder.FILE);
  if (!check) writeFileSync(path, bytes);
  outputs[recorder.FILE] = sha256(bytes);
}
const provenance = serialize({
  about:
    "Known answers of MnemoCode TS, recorded by its scripts/rust-parity.mjs from the build of one commit; the Rust tests replay them (RUST-14).",
  repository: "hobby-eng/mnemocode_typescript",
  commit,
  node: process.version,
  recorders: recorded,
  files: outputs,
});
const provenancePath = join(output, PROVENANCE);
if (check) {
  if (!existsSync(provenancePath) || readFileSync(provenancePath, "utf8") !== provenance)
    changed.push(PROVENANCE);
  if (changed.length > 0) {
    process.stderr.write(`The recordings differ from this build: ${changed.join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Recordings match the build of ${commit}.\n`);
} else {
  writeFileSync(provenancePath, provenance);
  process.stdout.write(`Recorded ${recorders().length} files from ${commit}.\n`);
}
