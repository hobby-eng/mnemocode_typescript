// The known answers of the restore of shares for the Rust port, part of recovery-v1.json: the
// sets of the public phrase, the checks of written shares and the restore in its steps. The recorder
// of recovery (recovery.mjs) calls them.

import { outcome } from "./shares.mjs";
import {
  DATE,
  DECODE,
  FINGERPRINT,
  LEGAL,
  NO_FINGERPRINT,
  SEED,
  TWELVE,
  replaced,
  resultPlain,
  steps,
  wallet,
} from "./recovery-common.mjs";

/** The shares of the public phrase, direct and masked, and of another phrase. */
export async function sets(all, { modules: shareSide, platform }) {
  const { split, transport, dates } = shareSide;
  const seeded = new split.ShareSplit(platform, (bytes) => bytes.fill(SEED));
  const days = [dates.parseDate(DATE)];
  const direct = await seeded.splitBackup({
    mnemonic: TWELVE,
    mode: "direct",
    dates: [],
    threshold: 2,
    count: 3,
  });
  const masked = await seeded.splitBackup({
    mnemonic: TWELVE,
    mode: "seedshift",
    dates: days,
    threshold: 2,
    count: 3,
  });
  const other = await seeded.splitBackup({
    mnemonic: LEGAL,
    mode: "direct",
    dates: [],
    threshold: 2,
    count: 3,
  });
  const words = (share) => transport.writeShare(share, "words");
  return {
    direct: direct.records,
    masked: masked.records,
    other: other.records,
    /** `share` in words, the element at `place`, from 0, marked. */
    marked: (share, place) => replaced(words(share), [place], "?"),
    words,
  };
}

/** What the check of shares says of each thing written. */
export async function shareChecks(all, shareSide, made) {
  const { check, dates } = all;
  const { platform } = shareSide;
  const [one, two] = made.direct;
  const [maskedOne, maskedTwo] = made.masked;
  const answers = [];
  const cases = [
    [{ mode: "direct" }, { backup: `${one};${two}` }],
    [{ mode: "direct" }, { backup: one }],
    [{ mode: "direct" }, { backup: `${one};${one}` }],
    [{ mode: "direct" }, { backup: `${one};${made.other[1]}` }],
    [{ mode: "direct" }, { backup: `${made.other[0]};${made.other[1]}` }],
    [{ mode: "direct" }, { backup: `${one};zzz` }],
    [{ mode: "direct" }, { backup: TWELVE }],
    [{ mode: "direct" }, { backup: `${made.marked(one, 8)};${two}` }],
    [
      { mode: "seedshift", dates: [DATE] },
      { backup: `${maskedOne};${maskedTwo}`, dates: DATE },
    ],
    [
      { mode: "seedshift", dates: [DATE] },
      { backup: `${maskedOne};${maskedTwo}`, dates: "24-09-2026" },
    ],
    [{ mode: "seedshift", dates: [DATE] }, { backup: `${maskedOne};${maskedTwo}` }],
    [{ mode: "seedshift" }, { backup: `${maskedOne};${maskedTwo}`, dates: DATE }],
    [{ mode: "seedshift" }, { backup: `${maskedOne};${maskedTwo}`, dates: "24-09-2026" }],
  ];
  for (const [original, written] of cases)
    answers.push({
      original,
      written,
      ...(await outcome(async () => {
        const checker = new check.ShareBackupCheck(
          {
            mnemonic: TWELVE,
            threshold: 2,
            mode: original.mode,
            dates: original.dates?.map(dates.parseDate),
          },
          platform,
          { decodeEntry: DECODE },
        );
        return resultPlain(await checker.check(written));
      })),
    });
  return answers;
}

/** A line of a report as data. */
export const linesOf = (lines) => lines.map((line) => ({ ...line }));

/** A share written again as data. */
export const repairedPlain = ({ number, text, format, record }) => ({
  number,
  text,
  format,
  record,
});

/** What a restore gave, as data. */
export function restoredPlain(outcome_) {
  const { kind, lines } = outcome_;
  if (kind === "phrases")
    return {
      kind,
      lines: linesOf(lines),
      places: [...outcome_.places],
      notes: [...outcome_.notes],
      sets: outcome_.sets.length,
      listed: [...outcome_.listed],
      phrases: outcome_.phrases.map((phrase) => ({
        phrase: phrase.mnemonic,
        held: phrase.held,
        dates: phrase.dates ?? null,
        matchedAt: phrase.matchedAt ?? null,
        warning: phrase.warning ?? null,
        repairs: phrase.repairs,
        backup: phrase.backup ?? null,
      })),
    };
  return {
    kind,
    lines: linesOf(lines ?? []),
    message: outcome_.message ?? null,
    question: outcome_.question ?? null,
  };
}

/** What a repair gave, as data. */
export function repairPlain(outcome_) {
  const { kind, lines } = outcome_;
  const base = {
    kind,
    lines: linesOf(lines ?? []),
    warning: outcome_.warning ?? null,
    message: outcome_.message ?? null,
    question: outcome_.question ?? null,
  };
  if (kind === "shares")
    return {
      ...base,
      shares: outcome_.shares.map(repairedPlain),
      form: outcome_.form ?? null,
      repairs: outcome_.repairs,
      notes: [...outcome_.notes],
    };
  if (kind === "variants")
    return {
      ...base,
      variants: outcome_.variants.map((variant) => ({
        fingerprint: variant.fingerprint ?? null,
        shares: variant.shares.map(repairedPlain),
        repairs: variant.repairs,
      })),
    };
  return base;
}

/** The input of a restore of `texts`. */
export function inputOf({ modules: shareSide }, texts) {
  const input = new shareSide.input.ShareInput({ decodeEntry: DECODE });
  input.add(texts);
  return input;
}

/** The restores and repairs of shares, each from what a host asks. */
export async function shareRestores(all, shareSide, made) {
  const { restore, dateSearch } = all;
  const { platform } = shareSide;
  const restorer = new restore.ShareRestore(platform);
  const [one, two] = made.direct;
  const [maskedOne, maskedTwo] = made.masked;
  const masked = [maskedOne, maskedTwo];
  const direct = [one, two];
  const cases = [
    { texts: direct, mode: "direct" },
    { texts: [one, two, made.direct[2]], mode: "direct" },
    { texts: [one, one, two], mode: "direct" },
    { texts: [one], mode: "direct" },
    { texts: [one, "zzz"], mode: "direct" },
    { texts: [one, made.other[1]], mode: "direct" },
    { texts: direct, mode: "direct", fingerprint: FINGERPRINT },
    { texts: direct, mode: "direct", fingerprint: NO_FINGERPRINT },
    { texts: direct, mode: "direct", dates: DATE },
    { texts: [made.marked(one, 8), two], mode: "direct" },
    { texts: [made.marked(one, 8), made.marked(two, 9)], mode: "direct" },
    { texts: [made.marked(one, 8), two], mode: "direct", fingerprint: FINGERPRINT },
    { texts: [made.marked(one, 8)], mode: "direct" },
    { texts: masked, mode: "seedshift", dates: DATE },
    { texts: masked, mode: "seedshift", dates: "24-09-2026" },
    { texts: masked, mode: "seedshift", dates: DATE, fingerprint: FINGERPRINT },
    { texts: masked, mode: "seedshift", dates: DATE, fingerprint: NO_FINGERPRINT },
    { texts: masked, mode: "seedshift", dates: "2?-09-2026", fingerprint: FINGERPRINT },
    { texts: masked, mode: "seedshift", dates: "2?-09-2026", fingerprint: NO_FINGERPRINT },
    { texts: masked, mode: "seedshift", dates: "2?-09-2026" },
    { texts: masked, mode: "seedshift", dates: "2?-09-2026", fingerprint: FINGERPRINT, keep: 2 },
    {
      texts: masked,
      mode: "seedshift",
      dates: "2?-09-2026",
      fingerprint: FINGERPRINT,
      limits: { dates: 5 },
    },
    {
      texts: masked,
      mode: "seedshift",
      dates: "2?-09-2026",
      fingerprint: FINGERPRINT,
      limits: { dates: 5 },
      confirmed: true,
    },
    { texts: [made.marked(maskedOne, 8), maskedTwo], mode: "seedshift", dates: DATE },
    {
      texts: [made.marked(maskedOne, 8), maskedTwo],
      mode: "seedshift",
      dates: "2?-09-2026",
      fingerprint: FINGERPRINT,
    },
    {
      texts: masked,
      mode: "seedshift",
      dates: "01-01-2000 02-01-2000 03-01-2000 04-01-2000 05-01-2000",
    },
    { texts: masked, mode: "seedshift" },
    { texts: direct, mode: "seedshift-legacy" },
  ];
  const restores = [];
  const repairs = [];
  for (const entry of cases) {
    const request = () => ({
      input: inputOf(shareSide, entry.texts),
      mode: entry.mode,
      dates:
        entry.dates === undefined
          ? undefined
          : dateSearch.DatesAnswer.parse(entry.dates, { patterns: true }),
      walletCheck: entry.fingerprint === undefined ? undefined : wallet(all, entry.fingerprint),
      limits: entry.limits,
      confirmed: entry.confirmed === true,
      now: steps(),
    });
    restores.push({
      ...entry,
      ...(await outcome(async () =>
        restoredPlain(await restorer.restore({ ...request(), keep: entry.keep })),
      )),
    });
    if (entry.keep !== undefined) continue;
    for (const form of [undefined, "colors"])
      repairs.push({
        ...entry,
        form: form ?? null,
        ...(await outcome(async () =>
          repairPlain(
            await restorer.repair({
              ...request(),
              form,
              fingerprintOf: (phrase) => all.evidence.masterFingerprint(phrase),
            }),
          ),
        )),
      });
  }
  return {
    restores,
    repairs,
    warnings: { needsThreshold: restore.WALLET_CHECK_NEEDS_THRESHOLD },
    several: [2, 3].map((count) => ({
      count,
      note: restore.severalSetsNote(count),
      withoutWallet: restore.variantsMessage(count, false),
      withWallet: restore.variantsMessage(count, true),
    })),
  };
}

/** Records every answer. */
