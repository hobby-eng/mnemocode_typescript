# AUD-039 remediation handover

This is an audit handover, not permission to commit, publish or change history. The owner
reserved implementation for Claude. Work only in the authoritative TypeScript checkout in
place. Its remote is `hobby-eng/mnemocode_typescript`; `hobby-eng/mnemocode` is the Rust
successor. Read the workspace and project AGENTS files and current coding guide first.

Read the paired [report](../AUD-039-2026-11-02.md) and
[JSON record](../AUD-039-2026-11-02.json), then the [coverage ledger](coverage.json).
The reviewed commit is `044a9edf0708cf6bf978643f2d365c75d25f5b90`; the 1,319-file
fingerprint is `ceb27b547fba24a2815a934fee93d362a0b8780b44307b0d3f196bc30af2bbc6`.
The initial snapshot and maintainer-only README/workflow transition are retained separately.
Compare current files with the finding's source hash before fixing: do not replace useful
changes made after this review. No production fix was made by the audit.

The baseline is now final for handover. Its findings will not be silently changed while fixes
are implemented; record remediation in a separate follow-up/addendum. Release acceptance is
incomplete: the one-worker full suite hit the 30-minute audit supervisor limit without a test
summary. The second suite and remaining heavy self-test/PTY/card/native/executable checks never
started while the shared lock was occupied. They are not passed. No audit job remains queued.
Run the required checks after the relevant fixes, with current source/checker identities.

## Ordered work

| Finding | Work | Meaningful verification |
| --- | --- | --- |
| AUD-039-BLD001, medium, release blocker | Correct TS signer and active help/download/security/issue/provenance routing. Preserve the deliberate Rust link at the beginning of README. Classify historical links separately. | `sign-release --dry-run` must address the TS repository for every `gh` operation. Do not sign or publish as a test. Update active URL assertions and examine all migration rows in the JSON report. |
| AUD-039-FUN001, medium, nonblocking | Require a digest-checked reference before an omitted share can identify an outlier. Keep digestless disagreement non-attributing. | Six public A,A,B threshold-one permutations in `digest-diagnosis.mjs`; retain checked 2-of-3 outlier control, equal unchecked sets, grouped threshold-one variants and CLI/ShareRestore propagation. |
| AUD-039-API001, low | Validate the direct external host callback's boolean result, without redundant validation of internal typed values. | `missing-check.mjs` must refuse malformed sync/async answers; valid true/false, stop/disposal behavior preserved. |
| AUD-039-API002, low | Reuse regular/nonblocking filename admission for interactive text and QR retries. | Actual no-writer FIFO through text retry, QR retry and next-share filename; regular-file/control/cancellation cases. Preserve explicitly supported headless streams. |
| AUD-039-API003, low | Make a refused stdout export fail reliably through shared output/flush handling. | Actual `/dev/full` ENOSPC must return failure; ordinary pipe payload unchanged, stderr warnings contain no material. Decide EPIPE behavior explicitly. Search all output variants. |
| AUD-039-UI001, low | Handle or refuse an unbreakable host-supplied heir-guide token that exceeds page width. | Real A5/A6 PDF glyph bounds in `heir-width.mjs`, normal routes, other text fields and vertical layout. |
| AUD-039-SEC001, low | Wipe internally created mixed-share temporary arrays once in `finally`, or avoid their unnecessary full copies. | Public six-form literals, successful/refused reads/writes and caller-input preservation. Observe ordinary ownership; do not invent intrinsic failures. |
| AUD-039-SEC002, low | Give the copied native interpolation `Vec` a zeroizing lifetime or avoid its redundant copy. | Targeted native tests, public share literals and approved canonical Docker regeneration/integrity comparison. No surviving optimized-memory leak was established by this finding. |
| AUD-039-BLD002, low | Add advisory-workflow concurrency/cancellation under CI-03. | Static workflow/gate validation; no paid dispatch needed. |

All nine findings are open in this baseline; none is fixed or verified. Historical related
IDs are context, not reopened old fixes. Low findings are retained and nonblocking under
the current audit rules. One Medium diagnosis issue is nonblocking for the bounded reason
in its finding; do not silently downgrade or omit it.

## How to verify without repeating the old audit

Use public all-zero/counting BIP39/SSKR fixtures only. Each reported defect has an external
cause or normal successful-path ownership omission under CORE-54. Check the exact rule and
actual caller boundary, search its variants, and add a regression that fails on the reviewed
baseline. Reuse established owners/platform seams instead of duplicating policy. Do not
create copies/worktrees or regenerate vectors from the code merely to make assertions pass.

The audit probes are baseline checks, not automatically installed project regressions.
Integrate appropriate minimal cases into existing suites and gates during remediation.
Retain the original red receipts; a green run after a fix has its own source/checker identity.
Use CORE-53 independent review after each cohesive fix and record its exact snapshot.
Native rebuild permission and canonical build requirements still apply; never substitute a
host-generated WASM artifact or patch generated glue alone.

Heavy commands use the shared workspace lock and a machine-memory budget with a reserve.
`run.mjs` is a sampled observer, not an isolation boundary. Explicitly check source-before/
after against the accepted snapshot, checker hashes and relevant artifact hashes before
reusing any receipt. It records source drift but does not fail solely because drift occurred.
Read the final report's command table: infrastructure stops, expected-red probes, initial
failed cache/inventory attempts and original suite attempts must not disappear behind reruns.

## Browser, wallet-tools and release acceptance

No browser page is shipped in this checkout. The wallet-tools session was stopped by the
owner; it did not perform fresh acceptance. Its retained import pins an earlier unreleased
TS revision: 182/217 imported files match and 35 differ. This comparison alone establishes
neither browser correctness nor a browser defect. Arrange the current host sync and browser
acceptance with its maintainer; do not edit another project from this handover.

Potential integration changes to record for that maintainer are the `MissingCodes.run`
callback refusal contract, threshold-one diagnosis without a named outlier, unchanged
portable temporary-array ownership and heir-guide width refusals. Output/TTY policy and
signer routing are native/tooling changes. No public method was changed by this audit.

Source version is still 0.1.0. Before a 0.2.0 tag, prepare coherent package/source version,
changelog/release notes/status, fix the signer target, and complete documented release
verification. Current three-OS CI checks fast/build/PTY, not complete source-test suites.
Do not call that green status proof of final 0.2.0 platform/browser/artifact acceptance.
Keep signing, publication and history changes under the owner's current authorization.
