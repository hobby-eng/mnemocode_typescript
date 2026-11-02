# AUD-039 harnesses

These audit-only commands review the TypeScript repository `hobby-eng/mnemocode_typescript`
at `044a9edf0708cf6bf978643f2d365c75d25f5b90`. The initial `25187ef` snapshot and the
maintainer-only README/new-workflow transition are retained separately. Run from the root, with the Node.js,
pnpm and Rust toolchains pinned by the repository. Use public fixtures only.

`run.mjs` retains one command's output, UTC times, exit status, source fingerprint and
sampled Linux memory in the local, ignored `docs/audits/AUD-039-evidence/` directory.
It requires that directory's `snapshot.json`, which lists the reviewed tracked files.
It never creates a checkout or modifies production inputs. Linux `/proc` and `getconf`
are needed for memory accounting. It is a sampled supervisor, not a kernel memory cap;
daemon-managed Docker containers need separate resource review.

Acquire the shared workspace lock before a heavy command:

```sh
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs format pnpm format:check
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs suite pnpm exec vitest run --maxWorkers=1
```

The default budget is 1536 MiB of combined child RSS, a 384 MiB Node heap and a 3 GiB
host reserve. `AUD039_RSS_MIB`, `AUD039_HEAP_MIB` and `AUD039_TIMEOUT_SECONDS` override
the individual command's bounds within the runner's checked ranges. Rust builds use one job.
The exact environment is retained in each command record; cryptographic parameters stay unchanged.

A completed child returns its actual exit code. A memory, timeout or process-cleanup stop
returns 125 and remains distinct from a product failure. Reusing a label refuses to overwrite
retained evidence. A source change is recorded explicitly and invalidates reuse for the old snapshot.

The supervisor records source drift but does not change its exit code solely for drift. Before
reusing a result, require an accepted before/after fingerprint, no changed files, the correct
exit/stop status, matching log/checker hashes and the relevant built-artifact identity. Sampling
cannot prove that every short-lived/orphaned child was observed or every Docker allocation capped.

## Fresh replay

If this checkout has no retained `snapshot.json`, `node docs/audits/AUD-039-harnesses/capture.mjs`
creates it from the current tracked files, without overwriting an earlier snapshot. A later
replay names its own bytes; it is not automatically evidence for the original audit. Do not
delete the project's old evidence or create a second checkout to run these commands.

`inventory.mjs` requires that snapshot and installed project dependencies. Run it with a fresh
runner label. It writes the local inventory and exits zero only when all listed file hashes
still match. Its declaration tokenizer is not a full TypeScript parser or semantic review.

Build once with `pnpm build` before dist-dependent probes. The input files are the repository's
public `vectors/sskr-v1.json`, bundled public fonts and the synthetic zero-entropy BIP39 phrase.
No user export folder or private recovery material is needed. POSIX FIFO and `/dev/full`
probes require Linux; the FIFO probe calls the existing Python PTY driver and standard library.

```sh
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs callback-replay node --import tsx docs/audits/AUD-039-harnesses/missing-check.mjs
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs stdout-replay node docs/audits/AUD-039-harnesses/output-failure.mjs
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs fifo-replay node docs/audits/AUD-039-harnesses/fifo-input.mjs
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs heir-replay node docs/audits/AUD-039-harnesses/heir-width.mjs
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs diagnosis-replay node docs/audits/AUD-039-harnesses/digest-diagnosis.mjs
flock ../tmp/heavy-checks.lock node docs/audits/AUD-039-harnesses/run.mjs unicode-replay node docs/audits/AUD-039-harnesses/unicode-bridge.mjs
```

Acquire the shared lock for rendering/native/full-suite work. On the reviewed baseline the first
five defect probes print their public observations and exit 1; the Unicode hypothesis probe
exits 0 for six bounded negative cases. A later fixed version should return 0 for the defect
checks while keeping their valid controls. An unrelated assertion/refusal is not a successful fix.
Static cleanup and workflow findings require the source-level verification described in the report.

The callback probe loads source through the installed `tsx` loader, as its recorded command
does. Other product probes use the fresh `dist/` or exact committed generated WASM/glue.
`release-checks.mjs` is the coordinator's ordered release-check schedule; run it under one
outer shared lock. Its two-worker suite has a 2304 MiB sampled RSS budget and a one-hour
supervisor limit, without changing the project's per-test timeouts. The earlier one-worker
30-minute stop is retained separately and is not a test pass.

`make-report.mjs` is for the coordinator's retained evidence set: snapshot, inventories, scoped
reviews, skeptic decisions, `report-notes.json`, reference classification and command receipts.
It writes the paired report and `coverage.json`, anonymizes public paths and checks log hashes.
It does not recreate human reviews or run product tests. Missing retained inputs must fail;
neither generated coverage nor the schema validator proves absence of bugs.

See [CLAUDE-HANDOVER.md](CLAUDE-HANDOVER.md) for remediation order. No harness authorizes a
commit, tag, publish, native regeneration or change to another repository.
