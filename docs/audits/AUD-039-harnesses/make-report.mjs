/** Assemble the audit from retained human review and command receipts; never invent a passed check. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const evidence = join(root, "docs/audits/AUD-039-evidence");
const out = join(root, "docs/audits");
const load = (name) => JSON.parse(readFileSync(join(evidence, name), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Published documents anonymize local paths; original local receipts keep their exact bytes.
const anonymous = (value) => JSON.parse(JSON.stringify(value).replaceAll(/\/home\/[^/"\\\s]+/gu, "/home/user"));
const snapshot = load("snapshot.json");
const inventory = load("inventory.json");
const skeptic = load("review-skeptic.json");
const notes = load("report-notes.json");
const receipts = readdirSync(evidence).filter((name) => name.endsWith(".command.json")).sort().map((name) => {
  const r = load(name);
  assert.equal(hash(readFileSync(join(evidence, name.replace(/\.command\.json$/u, ".log")))), r.logSha256, "Retained command log must keep its reviewed bytes.");
  return { label: name.replace(/\.command\.json$/u, ""), command: r.command, startedAtUtc: r.startedAtUtc, endedAtUtc: r.endedAtUtc, exitCode: r.exitCode, wrapperExitCode: r.wrapperExitCode, stopReason: r.stopReason, sourceBefore: r.sourceBefore, sourceAfter: r.sourceAfter, changedFiles: r.changedFiles, logSha256: r.logSha256, runnerSha256: r.runnerSha256, peakProcessRssBytes: r.peakProcessRssBytes, minimumAvailableBytes: r.minimumAvailableBytes, interpretation: notes.commandInterpretations[name.replace(/\.command\.json$/u, "")] ?? "See checks and limitations; an exit code alone is not acceptance." };
});
const reviews = ["core", "cli", "cards", "sskr"].map((group) => ({ group, name: `review-${group}.json`, data: load(`review-${group}.json`) }));
const assigned = new Map();
for (const review of reviews) for (const row of review.data.filesReviewed) assigned.set(row.path, { owner: review.group, depth: row.reviewDepth ?? row.depth, review: row.review ?? row.notes ?? row.analysis ?? null });
assigned.set("sskr-wasm/generated/recovery_sskr_wasm_bg.wasm", { owner: "sskr", depth: "binary hash/manifest and bounded actual-WASM probes; no semantic disassembly review", review: "Canonical reproduction is recorded separately from source and hash coverage." });
const full = new Set(notes.coordinatorFullReads);
const files = snapshot.files.map((f) => {
  const r = assigned.get(f.path);
  const archive = f.path.startsWith("docs/audits/");
  return { ...f, reviewOwner: r?.owner ?? "coordinator", reviewDepth: r?.depth ?? (archive ? "historical inventory/hash, JSON structure, privacy/package gates; not a new semantic audit" : full.has(f.path) ? "full semantic/static read" : "selected semantic paths plus inventory and applicable automatic gates; remaining portions not semantically reviewed"), reviewNote: r?.review ?? (archive ? "Retained historical evidence is not relabelled as newly executed." : notes.coordinatorNotes[f.path] ?? null) };
});
const coverage = anonymous({ auditId: "AUD-039", commit: snapshot.commit, sourceFingerprint: snapshot.sourceFingerprint, files, packageEntries: skeptic.independentCoverage.exportEntryCoverage, declarationInventory: { count: inventory.declarations.length, method: inventory.limitation }, operationCoverage: reviews.map((r) => ({ owner: r.group, operations: r.data.operationCoverage ?? r.data.publicOperationCoverage, reviewEvidence: { path: `docs/audits/AUD-039-evidence/${r.name}`, localOnly: true, sha256: hash(readFileSync(join(evidence, r.name))) } })), independentCompleteness: { reviewer: "separate skeptic", allCurrentSourceFilesAssigned: skeptic.independentCoverage.allCurrentSrcFilesAssigned, delegateCounts: skeptic.independentCoverage.perScope, gaps: notes.coverageLimitations }, scopeLimit: "Every tracked path and package entry is accounted for. A hash, archive inventory, selected tooling read, numeric parse or binary metadata read is not full semantic coverage or universal branch coverage." });
writeFileSync(join(out, "AUD-039-harnesses/coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
const findings = skeptic.findings.map((f) => {
  const value = { ...f, idStatus: "allocated in AUD-039", decision: "confirmed by coordinator and independent skeptic" };
  if (notes.executedFindings.includes(f.id)) value.reproduction = { ...f.reproduction, executedByCoordinator: true };
  return value;
}).sort((a, b) => ({ medium: 0, low: 1 }[a.severity] - { medium: 0, low: 1 }[b.severity]) || a.id.localeCompare(b.id));
const report = anonymous({ schemaVersion: 1, auditId: "AUD-039", auditNumber: 39, date: notes.date, title: "TypeScript 0.2.0 prerelease audit after repository migration", reviewer: { name: "Codex coordinator with four scoped reviewers and one independent skeptic", model: null, reasoningEffort: null }, snapshot: { commit: snapshot.commit, commitComplete: true, workingTree: "Clean product baseline; audit-only harnesses/reports added afterwards. Maintainer changed README and added audit.yml during review; both changes reconciled to this snapshot. No implementation changes made by this audit.", sourceFingerprint: snapshot.sourceFingerprint, initialCommit: load("snapshot-initial.json").commit, initialSourceFingerprint: load("snapshot-initial.json").sourceFingerprint, trackedFiles: snapshot.files.length, sourceVersion: "0.1.0", requestedNextVersion: "0.2.0", remote: "hobby-eng/mnemocode_typescript", transition: snapshot.sourceTransition }, scope: notes.scope, checks: notes.checks, findings, observations: [], remediation: findings.map((f) => ({ id: f.id, status: "open", fixCommit: null, verificationCommit: null, evidence: "Baseline only. Implementation changes were explicitly reserved for Claude by the owner." })), limitations: notes.limitations, assessment: notes.assessment, procedureHashes: load("procedure-hashes.json"), toolsAndSkills: notes.toolsAndSkills, commands: receipts, fileCoverage: { inventory: "AUD-039-harnesses/coverage.json", sha256: hash(readFileSync(join(out, "AUD-039-harnesses/coverage.json"))), trackedFiles: files.length, packageEntries: inventory.entries.length, syntacticDeclarations: inventory.declarations.length, caveats: notes.coverageLimitations }, artifactEvidence: notes.artifactEvidence, contextualObservations: notes.contextualObservations, referenceMigration: load("reference-migration.json"), hypothesisDisposition: notes.hypothesisDisposition, independentReview: { kind: "read-only scoped review, separate skeptical validation and completeness review", simultaneousReviewersMaximum: 2, distinctReviewers: 5, reviewerModel: null, reviewerReasoningEffort: null, evidenceFiles: [...reviews.map((r) => r.name), "review-skeptic.json"].map((name) => ({ path: `docs/audits/AUD-039-evidence/${name}`, localOnly: true, sha256: hash(readFileSync(join(evidence, name))) })) } });
const base = `AUD-039-${notes.date}`;
writeFileSync(join(out, base + ".json"), JSON.stringify(report, null, 2) + "\n");
const cell = (text) => String(text ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const show = (v) => typeof v === "string" ? v : JSON.stringify(v);
let md = `# AUD-039 — TypeScript 0.2.0 prerelease audit after repository migration\n\n## Record metadata\n\n- **Completed (UTC):** ${report.date}.\n- **Reviewer:** ${report.reviewer.name}. Exact model and reasoning effort are unavailable (JSON null).\n- **Reviewed commit:** \`${report.snapshot.commit}\`.\n- **Source fingerprint:** \`${report.snapshot.sourceFingerprint}\` (${files.length} tracked paths).\n- **Working tree:** ${report.snapshot.workingTree}\n- **Version:** source 0.1.0; requested next release 0.2.0. No 0.2.0 version/tag/release is asserted.\n- **Assessment:** ${report.assessment}\n\n## Finding register\n\n| Finding | Category | Kind | Severity | Status | Release blocking | Title |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const f of findings) md += `| ${f.id} | ${f.category} | finding | ${f.severity} | open | ${f.releaseBlocking} | ${cell(f.title)} |\n`;
md += `\n## Review evidence\n\n### Scope and methodology\n\n${show(report.scope)}\n\nProduct code, tests, dependencies, workflows and ordinary documentation were not edited. Only this audit's reports, harnesses and index entry are authored. The sole intentional link to the Rust successor in the opening README is preserved in the recommendations. Frozen historical reports are assessed separately from active TS routing.\n\n### Tools and skills\n\n`;
for (const item of report.toolsAndSkills) md += `- ${show(item)}\n`;
md += `\nNo new dependency or skill was installed. Availability is distinct from use; tools not run have no scan or coverage claim.\n\n### Procedure identity\n\n\`\`\`json\n${JSON.stringify(report.procedureHashes, null, 2)}\n\`\`\`\n\n### Coverage ledger\n\n[Per-file, public-entry and operation ledger](AUD-039-harnesses/coverage.json) records every tracked path, its hash and actual depth. There are ${inventory.entries.length} package entry points and ${inventory.declarations.length} token-discovered declarations/methods; declaration counts are not branch-coverage percentages.\n\n`;
for (const text of report.fileCoverage.caveats) md += `- ${text}\n`;
md += `\n| Check ID | Owner | Outcome | Evidence / limitation |\n| --- | --- | --- | --- |\n`;
for (const c of report.checks) md += `| ${c.checkId} | ${cell(c.primaryOwner)} | ${cell(c.outcome)} | ${cell(c.evidence)} |\n`;
md += `\n### Checks\n\nEach receipt below is local-only in \`docs/audits/AUD-039-evidence/\`, with UTC times, exact command, exit/stop state, source before/after, sampled memory and log hash. A red defect probe is expected to fail on this unfixed baseline. Controls and infrastructure failures remain distinct.\n\n| Label / command | Exit / supervisor | Result interpretation | Log SHA-256 |\n| --- | --- | --- | --- |\n`;
for (const r of report.commands) md += `| ${cell(r.label)}: \`${cell(r.command.join(" "))}\` | ${r.exitCode} / ${r.wrapperExitCode}${r.stopReason ? ` (${cell(r.stopReason)})` : ""} | ${cell(r.interpretation)} | \`${r.logSha256}\` |\n`;
md += `\n### Findings\n\n`;
for (const f of findings) {
  md += `#### ${f.id} — ${f.severity} — ${f.title}\n\n- **Category / kind / status:** ${f.category} / finding / open.\n- **Release blocking:** ${f.releaseBlocking}; ${f.releaseBlockingReason}\n- **Affected files:** ${f.locations.map((l) => `[${l.path}:${l.line}](../../${l.path}#L${l.line})`).join(", ")}.\n- **Reproduction:** ${show(f.reproduction)}\n- **Expected:** ${f.expected}\n- **Observed:** ${f.observed}\n- **Impact:** ${f.impact}\n- **Severity rationale:** ${f.severityRationale}\n- **Evidence:** ${f.evidence.length ? f.evidence.map((e) => `local-only \`${e.path}\`, SHA-256 \`${e.sha256}\``).join("; ") : "Static source trace at the pinned file hashes."}\n- **Recommended fix:** ${f.recommendedFix}\n- **Required verification:** ${f.requiredVerification}\n- **Related historical findings:** ${f.relatedFindings.length ? f.relatedFindings.join(", ") + "; those historical statuses are not reopened." : "None allocated to this root cause."}\n`;
}
md += `\n### Remediation and follow-up\n\nAll nine findings are open. No fix or verification commit exists for this baseline. Claude owns any subsequent implementation phase. [Handover](AUD-039-harnesses/CLAUDE-HANDOVER.md) gives the ordered work and evidence controls.\n\n### Repository reference migration\n\n`;
for (const item of report.referenceMigration.guidance) md += `- ${item}\n`;
md += `\n### Informational observations and recommendations\n\n`;
for (const text of report.contextualObservations) md += `- ${text}\n`;
md += `\n### Hypotheses and excluded candidates\n\n`;
for (const text of report.hypothesisDisposition) md += `- ${text}\n`;
md += `\n### Artifacts and provenance\n\n`;
for (const text of report.artifactEvidence) md += `- ${text}\n`;
md += `\n### Assessment and limitations\n\n${report.assessment}\n\n`;
for (const text of report.limitations) md += `- ${text}\n`;
writeFileSync(join(out, base + ".md"), anonymous(md));
console.log(JSON.stringify({ report: base, findings: findings.length, checks: report.checks.length, trackedFiles: files.length, packageEntries: inventory.entries.length }));
