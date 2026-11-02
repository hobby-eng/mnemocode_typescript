/** Reproduce AUD-039's file identity, package entry and declaration inventories; no review verdict. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tokensOf } from "../../../scripts/source-tokens.mjs";
import { exportedBodies, membersOf } from "../../../scripts/source-declarations.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const EVIDENCE = join(ROOT, "docs/audits/AUD-039-evidence");
const snapshot = JSON.parse(readFileSync(join(EVIDENCE, "snapshot.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const declarations = [];
const references = [];
const changed = [];
for (const file of snapshot.files) {
  const bytes = readFileSync(join(ROOT, file.path));
  if (digest(bytes) !== file.sha256) changed.push(file.path);
  if (file.kind === "binary") continue;
  const text = bytes.toString("utf8");
  if (!file.path.startsWith("docs/audits/"))
    for (const [index, line] of text.split("\n").entries())
      if (line.includes("hobby-eng/mnemocode"))
        references.push({ path: file.path, line: index + 1, text: line.trim() });
  if (!file.path.startsWith("src/") || !file.path.endsWith(".ts")) continue;
  const { tokens } = tokensOf(text);
  for (const [at, token] of tokens.entries()) {
    if (token.key !== "export") continue;
    let next = at + 1;
    while (["declare", "abstract", "async"].includes(tokens[next]?.key)) next += 1;
    const kind = tokens[next]?.key;
    if (!["class", "function", "const", "interface", "type", "let"].includes(kind)) continue;
    const nameAt = tokens[next + 1]?.key === "*" ? next + 2 : next + 1;
    const name = tokens[nameAt]?.key;
    declarations.push({ path: file.path, line: token.line, kind, name });
    if (kind !== "class") continue;
    for (const body of exportedBodies(tokens, at))
      for (const member of membersOf(tokens, body.open))
        if (member.public && member.params !== undefined)
          declarations.push({
            path: file.path,
            line: tokens[member.at].line,
            kind: "public-member",
            name: `${name}.${member.name}`,
          });
  }
}
const entries = Object.entries(manifest.exports).map(([entry, paths]) => ({
  entry,
  ...paths,
  source: paths.import.replace(/^\.\/dist\//u, "src/").replace(/\.js$/u, ".ts"),
}));
const result = {
  auditId: "AUD-039",
  commit: snapshot.commit,
  sourceFingerprint: snapshot.sourceFingerprint,
  fileCount: snapshot.files.length,
  changed,
  entries,
  declarations,
  references,
  limitation:
    "A token-based declaration inventory is not a complete TypeScript parser or a semantic review. Re-exports and caller contracts require the reviewers' separate operation ledger.",
};
writeFileSync(join(EVIDENCE, "inventory.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ files: result.fileCount, entries: entries.length, declarations: declarations.length, references: references.length, changed }));
process.exitCode = changed.length === 0 ? 0 : 1;
