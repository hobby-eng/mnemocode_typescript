# Using the TypeScript library

This guide is for applications that embed MnemoCode. For the standalone program, use the [README](../README.md) or [CLI reference](CLI.md). The package is distributed from this repository; it is not published to npm.

## Entry points

Import only the modules your host needs, for example `mnemocode/core/date-search`. The [module inventory](ARCHITECTURE.md#modules-for-other-hosts) lists entry points and their platform requirements; its dependency list is checked by `test/portable-modules.test.ts`.

The `mnemocode` and `mnemocode/sskr` entries supply Node.js services. `mnemocode/cards` and the individual host-neutral entries can be used by other hosts. Existing compatibility functions remain available alongside the owner classes.

Build the checkout with `corepack pnpm install --frozen-lockfile` and `corepack pnpm build`, then add that local package to your host. The imports below assume that the host resolves this package as `mnemocode`; it is not an npm registry installation command.

The source and tests compile with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. A browser host supplies its own platform services and security boundary.

## Encoding and decoding example

```ts
// Published BIP39 test data only. Never fund this wallet.
import { encodeMnemonic, formatEncoded, masterFingerprint, parseDate } from "mnemocode";
import { EncodedBackup } from "mnemocode/core/encoded-backup";

const mnemonic =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const dates = ["10-07-1963", "31-01-4489"].map(parseDate);
const encoded = encodeMnemonic(mnemonic, dates);
const unicode = formatEncoded(encoded, "unicode");
using encodedBackup = EncodedBackup.read(unicode, "unicode", "seedshift");
const recovered = encodedBackup.decode(dates);
// recovered.recoveredMnemonic is secret; do not log it.
const originalFingerprint = masterFingerprint(mnemonic);

// The same phrase in another form, without dates.
import { representMnemonic } from "mnemocode";
const direct = formatEncoded(representMnemonic(mnemonic), "unicode");
using directBackup = EncodedBackup.read(direct, "unicode", "direct");
const sameMnemonic = directBackup.decode([]);
```

The creating scope disposes both backups, including when decoding fails. Returned strings and
copied views belong to the caller; JavaScript cannot erase them when their owner is disposed.

## Platform services

SSKR host capabilities are narrow: `ShareCombiner` restores complete shares,
`ShareRepairPlatform` adds HMAC-SHA256, and `ShareSplitPlatform` adds creation with a restore
check. `SharePlatform` composes them all. A search run can supply `now`, a monotonic clock in
milliseconds, alongside its signal and event-loop turn; omitted clocks retain `performance.now`.
Timing methods accept the same optional clock, so tests need not replace global time.

Node.js adapters sit beside the host-neutral modules: `bitcoin-evidence.ts` supplies PBKDF2 for `WalletEvidenceCheck`, `sskr/share-platform-node.ts` supplies the share platform, and `export/platform-node.ts` supplies the render platform and `nodeCardRenderer`.

A browser host supplies these services itself:

- WebCrypto PBKDF2 is asynchronous. Pass it to `WalletEvidenceCheck` and use `matchAsync` as the wallet check for word searches, date searches and masked-share restoration.
- Share repair needs synchronous HMAC-SHA256 for each combination. Use the `hmac` implementation from `@noble/hashes`, rather than WebCrypto's asynchronous HMAC.
- Scanner-key encryption needs WebCrypto X25519 in a secure context, such as HTTPS or localhost. Without it, key encryption is refused; passphrase encryption remains available.
- Run long searches in a worker and pass an `AbortSignal`. At the next turn, cancellation returns the results found so far with the documented stopped marker (`stopped: true`, kind `"stopped"` or verdict `"stopped"`). Do not present it as a completed search with no matches.
- For page images, obtain PDF bytes and read them with `CardPdfReader` from `export/card-drawing.ts`, then paint its drawing steps on a canvas. The reader accepts only the PDF commands MnemoCode's renderers write; `test/card-drawing.test.ts` exercises every renderer. The CLI uses Poppler instead. Browser QR decoding also belongs to the host.

Filesystem access, the private terminal screen, Ctrl+C handling, sandboxing, and swap/cloud-folder warnings belong to the CLI. A browser host must implement its own input, storage and protection boundaries; see [Security](../SECURITY.md#library-and-browser-hosts).

## Feature checks

Each feature keeps its checks in a module beside it named with `-self-test`, a `SelfTestFeature` (`core/self-test-check.ts`): quick known answers for `core()` and a row of the full self-test. The library's are composed by `core/self-test.ts`, a host adds the rest, so a build without wallet evidence, coins or cards carries none of their checks or vector text. Each coin family has its own self-test beside it in `core/coins/` (such as `dash-self-test.ts`), which `core/coins-self-test.ts` composes for a host of every coin; a host of one family takes that family's alone, and `test/one-coin-builds.test.ts` checks that the modules of Dash carry no other coin's words.

## Lookup and coin modules

`mnemocode/core/word-table` exposes `WordTable`: lookup by a word, number or Unicode code,
numbered dictionary text, and the canonical mapping. It imports no Node.js, cards or shares.
`mnemocode/core/encoded-form` exposes `EncodedForm` directly: callers ask the form for its card
kind, color layout and masking rule, and whether its codes are the words of the phrase itself. The older functions in `core/words` and `core/backup-options`
remain compatibility adapters; internal callers use the owners.

Coin families and their self-tests also have independent package entries under
`mnemocode/core/coins/`: `bitcoin-like`, `bitcoin-cash`, `dash`, `ethereum`, `evm`, `cosmos`, `xrp`
and their `-self-test` modules. `core/coins/coin` exposes `CoinList` and the common address contract;
`core/coins/base58` exposes `Base58Coin` for host configurations. A host composes its list from the
families it needs; `core/coins` remains the composition of all supported families. Coin descriptions
and Base58 version records are owned snapshots. The identity and path properties are getter-only.

## Secret ownership

`EncodedBackup`, `ReEncoding`, `Share` and `PassphraseProtection` retain secrets in owned byte storage. Keep an owner live until every asynchronous operation using it has settled, then dispose it with `using` or call `wipe()` in `finally`. `[Symbol.dispose]()` calls `wipe()`; later secret reads are refused with `core.secret-value.wiped`.

Disposal cannot recall strings, frozen arrays or decoded views already returned to a caller, or guarantee erasure of dependency/runtime copies. Those views belong to their recipient.

### Encoded backups and re-encoding

`ReEncoding` snapshots its input backup. Disposing either owner leaves the other live and independent.

`BackupReading` owns its retained payload bytes until `wipe()` or `[Symbol.dispose]()`. Hosts keep it live through asynchronous mode/format questions and dispose it after creating the child backup or marked-code search, including refusal and cancellation paths. Those children own independent copies; ending the reading does not dispose them. Record mode/format metadata remains available after disposal, while payload-dependent operations refuse. Decoded strings and caller-owned inputs cannot be recalled or erased by this owner.

### Dates and searches

`DatesAnswer` keeps complete dates, numeric pattern lists, arbitrary pattern keys and typed positions in owned bytes. Pattern keys preserve every UTF-16 code unit, including lone surrogates; UTF-8 passphrase storage keeps its separate encoding contract. Its `copy()` preserves those values with an independent lifetime. `DateSearch` owns its indexes and a copy of its input answer: disposing either input or search leaves the other independent. An incomplete answer passed to `MissingCodesSearch.byWallet`, or an answer passed to `ShareUnmasking`, is borrowed until the returned way or unmasking has finished all its work; its creating caller disposes it afterwards.

`MissingCodes` likewise owns its retained candidate-place bytes and exposes `wipe()` / `[Symbol.dispose]()`. It closes active candidate iterators when disposed and refuses new secret reads; `withMode()` makes an independent owner. Keep it live through an asynchronous run. Successful and stopped runs transfer their kept `EncodedBackup` results to the caller, which disposes them; a failed run wipes those results itself. Candidate arrays already returned to a caller are independent views and cannot be recalled. Decode retains marked codes through any later result redisplay and ends them on retry or exit.

The prepared ways of `MissingCodesSearch` are disposable owners too: keep each way live through its awaited plan and run, then call `wipe()` or leave its `using` scope. Each way owns a byte snapshot of complete dates, borrows marked codes and any incomplete date answer, and releases its references to host callbacks when disposed. Ending a way never disposes those borrowed inputs. Later planning, running or publication after an awaited host callback is refused with `core.missing-codes-search.way-wiped`. A run disposes all temporary backups unless it transfers the sole matching backup to its caller; that backup and returned date views survive the way's disposal.

### Wallet comparisons

For repeated wallet comparisons, `WalletEvidenceCheck.prepare(evidence, passphrase)` returns an independently owned comparison with `match()` and `matchAsync()`. It retains passphrase bytes and the parsed evidence until its caller disposes it. The evidence is public material only: a WIF is turned into its public key when the evidence is read, and its private key is wiped at once, since a private key matches exactly where its public key does. A comparison that settles after disposal is refused. The service itself remains reusable; one-off `match()` and `matchAsync()` create and dispose a temporary comparison. Node's `walletCheckOf()` remains callable and also provides `wipe()` and `[Symbol.dispose]()`; keep it live through the awaited search, then dispose it. A search borrows that callback and never disposes it for its host.

### Shares and repair plans

`ShareInput` owns the code units of the shares it retains, including input that has not yet passed transport validation. Replacing that input ends its previous storage. Keep the input owner live through awaited restoration; disposal also prevents a later host result from being published. `ShareSet` owns independent copies of the restored phrase and repaired shares. `ShareExport` owns the shares to be written, and `inForm()` creates an independent export. Their creating callers dispose them after their asynchronous uses. Borrowed input objects and already-returned plain views remain independent; wiping an owner cannot recall those views.

Each `MarkedReading.of()` result is independently owned. Its `space()` solves into a `ReadingSpace` that owns a separate reading copy and exact affine coordinates; dispose both owners when their work ends. The space's `reading` getter borrows its child, so copy that reading to keep it beyond the space's lifetime. `withSpace()` scopes a temporary space for synchronous use. A joint repair plan owns its selected spaces and branches until `wipe()` or disposal, which a host may leave to a `using` scope; ending it refuses later searches and late publication with `sskr.joint-repair.plan-wiped`. Ordinary signal cancellation still returns the documented stopped outcome. `ShareVariantsError` carries only candidate count and changed places; candidate share records travel in the ordinary repair result.

### Rendering and output buffers

Render methods transfer ownership of fresh document buffers to their caller; failure wipes earlier owned results. Export methods wipe them after saving or refusing. A caller that uses a combined share document generator must close it when abandoning iteration, allowing the generator to wipe the yielded page. Joining documents borrows its inputs and does not erase them. Individual output filenames use the host-neutral `checkedExportFileName()` policy for both filesystem paths and browser downloads.

`CardPdfReader` owns its decoded image and font buffers. `pages()` borrows image bytes until the reader is wiped or disposed; `takePages()` transfers the images and ends the reader. The one-shot `readCardPages()` transfers them automatically. After painting, the host wipes transferred image `data` and `alpha` once per shared image. Wiping the reader leaves the input PDF unchanged. Immutable drawing views and copies made by dependencies or the runtime cannot be guaranteed erased.

`ShareCardSet` and the CLI's `EncodeCardExport` retain colors, labels and QR payloads in `CardValues`, which owns their UTF-16 code units in mutable bytes. Their creating callers keep the plan live through every awaited render and save, then call `wipe()` or leave its `using` scope. Wiping closes the owner immediately and refuses later secret reads with `core.secret-value.wiped`; a `ShareCardSet` render that finishes afterwards wipes its fresh document bytes and refuses publication. Public layout and share-reference metadata may remain. `forIndividualCards()` creates an independently owned plan; ending either plan leaves the other live. Encode borrows its backup without retaining the whole encoding outcome, shares the first pending planning operation, and caches only a completed live plan. A failed plan can be retried. Already returned job views and third-party decoded copies cannot be recalled or guaranteed erased.

### Candidate-list writers

`CandidateListWriter` owns its BIP39 passphrase and borrows its `ListProtection`; disposing the writer leaves that protection alone. The built-in protections implement `OwnedListProtection`, whose creating caller disposes it. A protection transfers fresh result bytes, or the input buffer itself, to the writer, which copies and wipes them. The CLI's `CandidatesFile` owns both its writer and its built-in protection. Saving entropies transfers them to that call, which wipes them on success, refusal and cancellation, including a refusal before writing starts.

## Cancellation and errors

Refusals use `core/error-catalog.ts`: each module owns its stable code list and default English messages, while one shared implementation creates the error. The code is immutable; the existing message, native `TypeError` or `RangeError` identity, and `cause` are preserved. `CodedFailure` is exported as a type from the core API. A host may display the default message or choose its own wording from the code; changing wording does not change a code. A refusal supplied by an existing shared rule uses `suppliedMessage`, without copying the rule's formatter. Specialized error classes carry a code of their module too: `CandidateFileRefusedError` takes its code and message from a catalog of its own, and names the step that failed as `problem`. Operational failures thrown by dependencies or host callbacks still pass through; they are not reclassified as cancellation.

Library searches use their documented stopped result, and a host must keep it separate from a completed search with no matches. If a host cancels after the final share-assessment callback, `ShareRestore.read` wipes the plan and returns the stopped result before timing or handing it out.

## Share-engine contracts

The bundled SSKR bridge returns `Error` objects with stable `sskr.engine.*` codes for its Rust-owned refusals; callers must not use raw thrown strings or parse messages to identify a failure. `CheckedSskrBridge` validates attached byte arrays before the generated glue copies a secret, owns and wipes the temporary input copies, and leaves borrowed caller buffers unchanged. A host converting a member threshold/count to bytes must first call `CheckedSskrBridge.groupSpecifications(threshold, count)` so values such as 258 cannot silently become 2. Once a call returns, the engine's memory holds no copy of a secret or a share: the bridge writes and reads share text itself, overwrites each heap block as it is freed and overwrites the stack that the SSKR library used (`sskr-wasm/rust/src/share_text.rs`, and `ALLOCATOR` and `scrub_stack` in `lib.rs`), and `test/sskr-engine-memory.test.ts` searches the built engine's memory. Source, generated glue/WASM and `integrity.json` are synchronized together.

For library callers, `combineSskrShares` returns a phrase only when no supplied shares or repaired elements remain unchecked and the hash checked the secret. `combineSskrShareSet` returns the phrase together with `unchecked` (share numbers counted from 1), `unsettled` repair elements and `digestUnchecked` where no hash checked the phrase; callers using this partial-recovery API must report those limits. Both functions, and `restoreShareSet` for complete input, are exported from `mnemocode/sskr`. For complete shares they refuse a member given more than once, even as an exact copy; `sskr-combine` leaves such copies out before it calls them.

The single-share `repairCandidates` listing defaults to `freeBits: 4` and accepts integer budgets from 0 to 8, at most 256 solutions per solved reading. Unsupported budgets are refused before reading the share; the result is never silently truncated. Joint recovery has [separate search limits](SSKR.md#damaged-shares).

A host implementing `ShareCombiner` returns fresh entropy or throws `ShareCombineRefusalError` for an invalid quorum or digest. The pinned native engine's matching `sskr.engine.combine` code has the same meaning. Other engine, initialization and host failures propagate as failures, not as an empty candidate list or an accusation that valid shares are wrong. A joint confirmation skips only a completed negative share-set result; an unavailable engine or an exhausted reference budget is not such a result.

## Candidate-list encryption

For the MNCL byte format, ordering, encryption parameters and limits, see [Candidate lists](CANDIDATES.md). The interfaces below implement that format for both writers and readers.

### Initialization and rechecks

`CandidateEncryption` gates operations on fast known-answer checks. Keep one instance for a host session and pass it to protections, or use the module functions' shared gate, one per realm, as the CLI does.

Before enabling key or passphrase controls, await `ready("key")` or `ready("passphrase")`. The shared equivalents are `assertCandidateEncryptionReady("key")` and `assertCandidateEncryptionReady("passphrase")`. Encryption and decryption enforce the gate themselves too.

Concurrent requests share initialization. Success is cached; failed initialization can be retried and starts no user encryption. An explicit `recheck()`, or `checkCandidateEncryptionQuick()` for the shared gate, replaces cached readiness: new operations wait, and an in-flight result is withheld if that recheck fails.

Ordinary startup does not run these asynchronous checks. The fast symmetric check needs neither WebCrypto nor scrypt, so passphrase encryption can work without `crypto.subtle`. Key operations also require WebCrypto and X25519 known answers. The full self-test repeats the fast checks and separately runs the slower scrypt answer at the normal work factor.

### Identities and protection selection

`src/core/candidate-encryption.ts` uses `age-encryption` 0.3.1 through its supporting modules. `CandidateEncryption` provides `createSessionIdentity`, `encrypt`, `encryptWithPassphrase` and `decrypt`. The shared-gate functions are `createSessionIdentity`, `encryptCandidates`, `encryptCandidatesWithPassphrase` and `decryptCandidates`.

`createSessionIdentity` returns a `SessionIdentity` for the Scanner's one-time key. It owns private-key bytes from creation, exposes the public `recipient` to writers, and reveals only its kind through `toString`, `toJSON` and Node.js inspect. Pass the object itself to `decryptCandidates(file, { identity: session })`, then end the session with `wipe()` or disposal.

An identity of another type is refused with `core.candidate-encryption.not-session-identity`. A session ended before or during decryption is refused with `core.secret-value.wiped`; any list already decrypted is wiped instead of returned. `SessionIdentity.fromText` supports published X25519 age test identities. Invalid or post-quantum identity text is refused without repeating it (`core.candidate-file-refusal.identity-invalid`).

Choose a writer's protection once through `ListProtection`: `ScannerKeyProtection`, `PassphraseProtection` or `NoProtection`. The first two use the host's gate when supplied. For a data-based choice, pass one of these to `protectionFor`, with that gate:

- `{ kind: "key", recipient }`
- `{ kind: "passphrase", passphrase }`
- `{ kind: "none" }`

Other kinds or fields are refused. Plaintext requires an explicit `none`; the CLI exposes it as `--plaintext-candidates` with a warning. Readers decide whether to admit plaintext. `parseListPassphrase` applies the [format's passphrase rules](CANDIDATES.md#encryption) consistently across hosts.

### File admission for hosts

`CandidateFileAdmission` from `core/candidate-file-admission` is the shared policy for readers and writers. `parameters()` returns frozen byte ceilings: `headerBytes` (65,536), `plaintextBytes` (155,189,248) and `encryptedBytes` (155,292,688). The plaintext ceiling follows from the maximum MNCL v1 fields, CRC and Padmé padding. The encrypted ceiling adds the bounded header, age's 16-byte nonce, and one 16-byte authentication tag per 65,536 plaintext bytes, including a tag for an empty payload. A byte ceiling permits a size; it does not prove that the contents form a valid list.

These are format limits, not a bound on process memory. Decoded records and mnemonic strings take more memory than their file bytes, and decrypting collects chunks before joining them. A host should release ciphertext and plaintext as soon as they are no longer needed, wipe the opened list when finished, and avoid keeping repeated results of `candidates()`.

`OpenedCandidateList.wipe()` is terminal: it clears owned entropy and UTF-8 passphrase buffers, releases records, and subsequent `candidates()` calls are refused. The count and passphrase-presence flags remain available as metadata. Strings or copies already returned to a host cannot be erased by disposing the list.

Before reading an encrypted file in full or asking for a key, call `await CandidateFileAdmission.inspect(file.size, readPrefix)`. It refuses an oversized file without calling the reader, requests exactly `min(file.size, headerBytes)` bytes once, validates the complete single-recipient header and returns `"key"` or `"passphrase"`, without X25519 or scrypt work. The reader returns a fresh `Uint8Array` of exactly the requested length and transfers ownership to admission, which wipes it on success or refusal. For a browser `File`, the callback can read `file.slice(0, length).arrayBuffer()` and wrap it in a `Uint8Array`. A short or oversized returned prefix is refused.

For an explicitly permitted plaintext import, call `assertSize(file.size, "plaintext")` before reading. For either form, the host must bound its subsequent read, call `assertSize(bytes.byteLength, form)` on the bytes actually obtained, and perform the format validation; an earlier prefix check does not authenticate the whole file. `listFileLock` delegates to the same header policy, and `decryptCandidates` repeats admission before opening already buffered bytes. The plaintext decoder and all protection variants use the same plaintext ceiling. Decrypted chunks are counted before joining them; overflow or authentication failure wipes accumulated chunks and cancels the reader. Size and header refusals remain `CandidateFileRefusedError` with `problem: "unsupported"`; a changed prefix length is `problem: "damaged"`. Each condition has a `code` of its own, such as `core.candidate-file-refusal.encrypted-file-too-large` or `core.candidate-file-refusal.header-read-short`, so a host can choose its own words from it; `CandidateFileRefusedError.isRefusal` tells a refusal by its codes, and `CandidateFileRefusedError.create` makes one, such as `file-changed-while-read` for a file that changed between its checks and its read.

## Input helpers and output names

`core/byte-array.ts` admits attached byte arrays using their intrinsic storage, without trusting a prototype or an own length getter: `byteArrayLength(value)` gives the length in bytes or undefined, and `isByteArray(value)` asks whether it is one. The candidate list and checked SSKR bridge share it. `export/file-name.ts` owns safe output-name validation for both filesystem exports and browser downloads: `checkedExportFileName(name)` returns the name or refuses it. A separate card is named after its number alone (`separateCardName` in `card-codes.ts`), never after the code it prints.
